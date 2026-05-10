namespace Commerce.Api.Entities;

public sealed class Location
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    /// <summary>warehouse | store | virtual</summary>
    public required string Type { get; set; }
}
