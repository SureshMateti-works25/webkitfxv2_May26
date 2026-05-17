using System.Text;
using Microsoft.Extensions.Options;

namespace Commerce.Api.Orders;

public sealed class OrderEmailOptions
{
    public string FromAddress { get; set; } = "orders@webkitfx.local";
    public string[] AdminNotificationEmails { get; set; } = [];
    public string OutboxDirectory { get; set; } = "uploads/order-emails";
}

public sealed class DevOrderEmailNotifier(
    IOptions<OrderEmailOptions> options,
    IWebHostEnvironment env,
    ILogger<DevOrderEmailNotifier> logger) : IOrderEmailNotifier
{
    public async Task NotifyOrderPlacedAsync(
        OrderPlacedEmailContext order,
        IReadOnlyList<OrderEmailRecipient> adminRecipients,
        IReadOnlyDictionary<string, IReadOnlyList<OrderEmailRecipient>> vendorRecipientsByPortalUserId,
        CancellationToken ct = default)
    {
        var outboxRoot = Path.Combine(env.ContentRootPath, options.Value.OutboxDirectory.Trim().TrimStart('/', '\\'));
        Directory.CreateDirectory(outboxRoot);

        foreach (var admin in adminRecipients)
        {
            var body = BuildBody(order, order.Lines, $"Admin notification — order {order.OrderId}");
            await WriteOutboxAsync(outboxRoot, order.OrderId, admin.Email, "admin", body, ct);
            logger.LogInformation("Order {OrderId}: admin email queued for {Email}", order.OrderId, admin.Email);
        }

        foreach (var (vendorUserId, recipients) in vendorRecipientsByPortalUserId)
        {
            var vendorLines = order.Lines
                .Where(l => string.Equals(l.VendorPortalUserId, vendorUserId, StringComparison.Ordinal))
                .ToList();
            if (vendorLines.Count == 0) continue;

            foreach (var vendor in recipients)
            {
                var body = BuildBody(order, vendorLines, $"Vendor notification — order {order.OrderId}");
                await WriteOutboxAsync(outboxRoot, order.OrderId, vendor.Email, $"vendor-{vendorUserId}", body, ct);
                logger.LogInformation(
                    "Order {OrderId}: vendor email queued for {Email} (vendor {VendorUserId})",
                    order.OrderId,
                    vendor.Email,
                    vendorUserId);
            }
        }
    }

    private static string BuildBody(
        OrderPlacedEmailContext order,
        IReadOnlyList<OrderLineEmailRow> lines,
        string subjectHint)
    {
        var sb = new StringBuilder();
        sb.AppendLine(subjectHint);
        sb.AppendLine();
        sb.AppendLine($"Order: {order.OrderId}");
        sb.AppendLine($"Placed: {order.PlacedAt:u}");
        sb.AppendLine($"Shopper: {order.ShopperName ?? "—"} <{order.ShopperEmail}>");
        if (!string.IsNullOrWhiteSpace(order.ShopperPhone))
            sb.AppendLine($"Phone: {order.ShopperPhone}");
        sb.AppendLine($"Ship to: {order.ShippingAddressText}");
        sb.AppendLine($"Payment: {order.PaymentMethod} ({order.PaymentStatus})");
        sb.AppendLine($"Total: {order.Currency} {order.TotalMinor / 100m:F2}");
        sb.AppendLine();
        sb.AppendLine("Lines:");
        foreach (var ln in lines)
        {
            var sku = string.IsNullOrWhiteSpace(ln.SkuCode) ? "" : $" SKU {ln.SkuCode}";
            sb.AppendLine(
                $"- {ln.Quantity} × {ln.TitleDisplay}{sku} @ {ln.Currency} {ln.UnitPriceMinor / 100m:F2}");
            if (!string.IsNullOrWhiteSpace(ln.VendorCode))
                sb.AppendLine($"  Vendor: {ln.VendorCode}");
        }
        return sb.ToString();
    }

    private async Task WriteOutboxAsync(
        string outboxRoot,
        string orderId,
        string toEmail,
        string roleTag,
        string body,
        CancellationToken ct)
    {
        var safeEmail = toEmail.Replace('@', '_').Replace('.', '_');
        var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{orderId}_{roleTag}_{safeEmail}.eml";
        var path = Path.Combine(outboxRoot, fileName);
        var eml = new StringBuilder();
        eml.AppendLine($"From: {options.Value.FromAddress}");
        eml.AppendLine($"To: {toEmail}");
        eml.AppendLine($"Subject: [Nistta] Order {orderId} placed");
        eml.AppendLine("Content-Type: text/plain; charset=utf-8");
        eml.AppendLine();
        eml.Append(body);
        await File.WriteAllTextAsync(path, eml.ToString(), ct);
    }
}
