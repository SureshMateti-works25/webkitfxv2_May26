using System.Text.Json;

namespace Commerce.Api.Catalog;

/// <summary>Corner / edge badges on product imagery (cards + PDP), optionally driven by <c>commerce.merchandising.imageIndicators</c>.</summary>
public static class ProductMerchandisingIndicators
{
    public const int DefaultCardMax = 3;
    public const int DefaultDetailMax = 6;

    /// <summary>Builds overlay badges for storefront imagery. Uses JSON overrides when <c>merchandising.imageIndicators</c> is non-empty.</summary>
    public static IReadOnlyList<ProductImageIndicatorDto> Build(
        string? commerceJson,
        long? minPriceMinor,
        long? listPriceMinor,
        long? offerPriceMinorResolved,
        string? offerType,
        string? offerCardText,
        DateTimeOffset? publishedAt,
        DateTimeOffset nowUtc,
        int maxCount,
        bool compactCard)
    {
        maxCount = Math.Clamp(maxCount, 1, 12);
        var custom = TryParseCustom(commerceJson, maxCount);
        if (custom.Count > 0)
            return custom;

        var cap = compactCard ? Math.Min(maxCount, 2) : maxCount;
        var badges = new List<ProductImageIndicatorDto>(cap);

        var offerOn = !string.IsNullOrWhiteSpace(offerType)
            && !string.Equals(offerType, "none", StringComparison.OrdinalIgnoreCase);
        long? sale = offerPriceMinorResolved ?? minPriceMinor;

        var hasStrike = listPriceMinor is > 0 and var listMrp && sale is > 0 and var saleAmt && listMrp > saleAmt;

        if (offerOn && sale.HasValue)
        {
            var lbl = CompactOfferLabel(offerCardText, compactCard);
            badges.Add(new ProductImageIndicatorDto("offer", lbl, "top-start"));
        }
        else if (hasStrike)
        {
            badges.Add(new ProductImageIndicatorDto("sale", compactCard ? "SALE" : "On sale", "top-start"));
        }

        if (publishedAt is { } pub && (nowUtc - pub).TotalDays <= 21 && badges.Count < cap)
            badges.Add(new ProductImageIndicatorDto("new", "NEW", "top-end"));

        if (badges.Count > cap)
            return badges.Take(cap).ToList();
        return badges;
    }

    private static List<ProductImageIndicatorDto> TryParseCustom(string? commerceJson, int maxCount)
    {
        var r = new List<ProductImageIndicatorDto>();
        if (string.IsNullOrWhiteSpace(commerceJson))
            return r;
        try
        {
            using var doc = JsonDocument.Parse(commerceJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return r;
            if (!doc.RootElement.TryGetProperty("merchandising", out var merch) || merch.ValueKind != JsonValueKind.Object)
                return r;
            if (!merch.TryGetProperty("imageIndicators", out var arr) || arr.ValueKind != JsonValueKind.Array)
                return r;

            foreach (var el in arr.EnumerateArray())
            {
                if (r.Count >= maxCount)
                    break;
                if (el.ValueKind != JsonValueKind.Object)
                    continue;
                var kind = ReadStringProp(el, "kind") ?? "tag";
                var label = ReadStringProp(el, "label");
                var placement = NormalizePlacement(ReadStringProp(el, "placement"));
                r.Add(new ProductImageIndicatorDto(kind.Trim(), string.IsNullOrWhiteSpace(label) ? null : label.Trim(), placement));
            }
        }
        catch
        {
            /* ignore malformed commerce */
        }

        return r;
    }

    private static string? ReadStringProp(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.String)
            return null;
        return p.GetString()?.Trim();
    }

    private static string NormalizePlacement(string? p)
    {
        if (string.IsNullOrWhiteSpace(p))
            return "top-start";
        var s = p.Trim().ToLowerInvariant();
        return s switch
        {
            "topleft" or "top-left" or "start" => "top-start",
            "topright" or "top-right" or "end" => "top-end",
            "bottomleft" or "bottom-left" => "bottom-start",
            "bottomright" or "bottom-right" => "bottom-end",
            "bottomcenter" or "bottom-center" => "bottom-center",
            _ => s.Replace("_", "-", StringComparison.Ordinal)
        };
    }

    private static string? CompactOfferLabel(string? offerCardText, bool compact)
    {
        var t = offerCardText?.Trim();
        if (string.IsNullOrEmpty(t))
            return compact ? "OFFER" : "Special offer";
        if (!compact)
            return t.Length > 28 ? t[..28].TrimEnd() + "…" : t;
        return t.Length > 10 ? t[..10].TrimEnd() + "…" : t;
    }
}
