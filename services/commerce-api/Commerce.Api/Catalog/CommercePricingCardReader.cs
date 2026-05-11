using System.Text.Json;

namespace Commerce.Api.Catalog;

/// <summary>Reads storefront card fields from <c>Product.CommerceJson</c> under <c>pricing</c>.</summary>
public static class CommercePricingCardReader
{
    public static CommercePricingCardFields ReadCard(string? commerceJson)
    {
        if (string.IsNullOrWhiteSpace(commerceJson))
            return default;

        try
        {
            using var doc = JsonDocument.Parse(commerceJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("pricing", out var pricing)
                || pricing.ValueKind != JsonValueKind.Object)
                return default;

            var listPriceMinor = ReadOptionalMinor(pricing, "listPriceMinor");
            var offerPriceMinor = ReadOptionalMinor(pricing, "offerPriceMinor");

            string? offerType = null;
            if (pricing.TryGetProperty("offerType", out var ot) && ot.ValueKind == JsonValueKind.String)
            {
                var s = ot.GetString()?.Trim();
                if (!string.IsNullOrEmpty(s))
                    offerType = s;
            }

            string? cardText = null;
            if (pricing.TryGetProperty("offerCardText", out var oct) && oct.ValueKind == JsonValueKind.String)
                cardText = oct.GetString()?.Trim();
            if (string.IsNullOrEmpty(cardText)
                && pricing.TryGetProperty("offerLabel", out var ol)
                && ol.ValueKind == JsonValueKind.String)
                cardText = ol.GetString()?.Trim();

            return new CommercePricingCardFields(
                listPriceMinor,
                offerPriceMinor,
                offerType,
                string.IsNullOrEmpty(cardText) ? null : cardText);
        }
        catch
        {
            return default;
        }
    }

    /// <summary>
    /// When <c>offerType</c> is active but JSON has no <c>offerPriceMinor</c>, card APIs use the product’s
    /// minimum (“from”) price in minor units as the sale price.
    /// </summary>
    public static long? ResolveOfferPriceMinorForCard(CommercePricingCardFields f, long? minPriceMinor)
    {
        if (f.OfferPriceMinor.HasValue)
            return f.OfferPriceMinor;
        if (string.IsNullOrWhiteSpace(f.OfferType)
            || string.Equals(f.OfferType, "none", StringComparison.OrdinalIgnoreCase))
            return null;
        return minPriceMinor;
    }

    private static long? ReadOptionalMinor(JsonElement parent, string name)
    {
        if (!parent.TryGetProperty(name, out var el) || el.ValueKind == JsonValueKind.Null)
            return null;
        if (el.ValueKind == JsonValueKind.Number)
        {
            if (el.TryGetInt64(out var i))
                return i;
            if (el.TryGetDecimal(out var d))
                return (long)Math.Round(d, MidpointRounding.AwayFromZero);
        }

        if (el.ValueKind == JsonValueKind.String)
        {
            var raw = el.GetString()?.Trim();
            if (string.IsNullOrEmpty(raw))
                return null;
            if (long.TryParse(raw, out var s))
                return s;
        }

        return null;
    }
}

public readonly record struct CommercePricingCardFields(
    long? ListPriceMinor,
    long? OfferPriceMinor,
    string? OfferType,
    string? OfferCardText);
