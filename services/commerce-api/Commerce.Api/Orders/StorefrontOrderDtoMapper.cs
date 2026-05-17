using System.Text.Json;
using Commerce.Api.Catalog;
using Commerce.Api.Entities;

namespace Commerce.Api.Orders;

public static class StorefrontOrderDtoMapper
{
    public static object ToDto(
        StorefrontOrder order,
        bool vendorScoped = false,
        string? vendorPortalUserId = null,
        IReadOnlyList<FulfillmentStatusLookupRow>? fulfillmentProgression = null)
    {
        var lines = order.Lines.AsEnumerable();
        if (vendorScoped && !string.IsNullOrWhiteSpace(vendorPortalUserId))
            lines = lines.Where(l => string.Equals(l.VendorPortalUserId, vendorPortalUserId, StringComparison.Ordinal));

        var lineDtos = lines.ToList();
        var lineList = lineDtos.Select(ToLineDto).ToList();
        var fulfillment = StorefrontOrderFulfillment.Normalize(order.FulfillmentStatus);
        var vendorTotal = lineDtos.Sum(l => l.UnitPriceMinor * l.Quantity);

        return new
        {
            id = order.Id,
            shopperEmail = order.ShopperEmail,
            shopperName = order.ShopperName,
            shopperPhone = order.ShopperPhone,
            shippingAddress = DeserializeAddress(order.ShippingAddressJson),
            productTypeId = order.ProductTypeId,
            status = order.Status,
            fulfillmentStatus = fulfillment,
            trackingNote = order.TrackingNote,
            statusUpdatedAt = order.StatusUpdatedAt,
            trackingTimeline = fulfillmentProgression is { Count: > 0 }
                ? FulfillmentStatusLookup.BuildTimeline(fulfillmentProgression, fulfillment)
                : FulfillmentStatusLookup.BuildTimeline(FulfillmentStatusLookup.DefaultRows(
                    FulfillmentStatusLookup.AdminLookupTypeId), fulfillment),
            paymentMethod = order.PaymentMethod,
            paymentStatus = order.PaymentStatus,
            totalMinor = vendorScoped ? vendorTotal : order.TotalMinor,
            currency = order.Currency,
            placedAt = order.PlacedAt,
            lines = lineList,
        };
    }

    private static object ToLineDto(StorefrontOrderLine l) => new
    {
        id = l.Id,
        productId = l.ProductId,
        skuId = l.SkuId,
        skuCode = l.SkuCode,
        titleDisplay = l.TitleDisplay,
        vendorCode = l.VendorCode,
        vendorPortalUserId = l.VendorPortalUserId,
        quantity = l.Quantity,
        unitPriceMinor = l.UnitPriceMinor,
        currency = l.Currency,
        lineTotalMinor = l.UnitPriceMinor * l.Quantity,
    };

    private static object? DeserializeAddress(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        return JsonSerializer.Deserialize<JsonElement>(json);
    }

}
