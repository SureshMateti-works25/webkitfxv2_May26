namespace Commerce.Api.Orders;

public sealed record OrderEmailRecipient(string Email, string RoleLabel);

public sealed record OrderPlacedEmailContext(
    string TenantId,
    string OrderId,
    string ShopperEmail,
    string? ShopperName,
    string? ShopperPhone,
    string ShippingAddressText,
    string PaymentMethod,
    string PaymentStatus,
    string Currency,
    long TotalMinor,
    DateTimeOffset PlacedAt,
    IReadOnlyList<OrderLineEmailRow> Lines);

public sealed record OrderLineEmailRow(
    string TitleDisplay,
    string? SkuCode,
    int Quantity,
    long UnitPriceMinor,
    string Currency,
    string? VendorCode,
    string? VendorPortalUserId);

public interface IOrderEmailNotifier
{
    Task NotifyOrderPlacedAsync(
        OrderPlacedEmailContext order,
        IReadOnlyList<OrderEmailRecipient> adminRecipients,
        IReadOnlyDictionary<string, IReadOnlyList<OrderEmailRecipient>> vendorRecipientsByPortalUserId,
        CancellationToken ct = default);
}
