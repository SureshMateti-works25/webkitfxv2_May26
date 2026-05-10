using Catalog.Api.Data;
using Catalog.Api.Entities;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<CatalogDbContext>(options =>
{
    var cs = builder.Configuration.GetConnectionString("Catalog")
        ?? throw new InvalidOperationException("Connection string 'Catalog' is missing. Use appsettings, User Secrets, or env ConnectionStrings__Catalog.");
    options.UseNpgsql(cs);
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await using (var scope = app.Services.CreateAsyncScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        await db.Database.MigrateAsync();
        if (!await db.Tenants.AnyAsync())
        {
            db.Tenants.Add(new Tenant { Id = "t1", Name = "Acme Sarees", Slug = "acme" });
            await db.SaveChangesAsync();
        }
    }
}

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "catalog-api" }))
    .WithName("Health");

app.MapGet("/api/v1/tenants", async (CatalogDbContext db, CancellationToken ct) =>
{
    var list = await db.Tenants.AsNoTracking().OrderBy(t => t.Slug).ToListAsync(ct);
    return Results.Ok(list);
}).WithName("ListTenants");

app.MapPost("/api/v1/tenants", async (Tenant body, CatalogDbContext db, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(body.Id) || string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Slug))
        return Results.BadRequest(new { error = "id, name, and slug are required" });

    db.Tenants.Add(body);
    try
    {
        await db.SaveChangesAsync(ct);
    }
    catch (DbUpdateException)
    {
        return Results.Conflict(new { error = "duplicate id or slug" });
    }

    return Results.Created($"/api/v1/tenants/{Uri.EscapeDataString(body.Id)}", body);
}).WithName("CreateTenant");

app.Run();
