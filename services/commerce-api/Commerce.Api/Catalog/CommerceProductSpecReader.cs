using System.Text.Json;

namespace Commerce.Api.Catalog;

/// <summary>Reads storefront product-spec fields from <c>Product.CommerceJson</c> under <c>productSpec</c>.</summary>
public static class CommerceProductSpecReader
{
    public static ProductSpecDto? Read(string? commerceJson)
    {
        if (string.IsNullOrWhiteSpace(commerceJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(commerceJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("productSpec", out var spec)
                || spec.ValueKind != JsonValueKind.Object)
                return null;

            var mou = ReadString(spec, "mou");
            var brand = ReadString(spec, "brand");
            var family = ReadString(spec, "productFamily");
            var model = ReadString(spec, "model");
            var unitsPerPack = ReadOptionalInt(spec, "unitsPerPack");
            var shelfLifeDays = ReadOptionalInt(spec, "shelfLifeDays");

            ProductDimensionsDto? dimensions = null;
            if (spec.TryGetProperty("dimensions", out var dim) && dim.ValueKind == JsonValueKind.Object)
            {
                dimensions = new ProductDimensionsDto(
                    ReadOptionalInt(dim, "weightGrams"),
                    ReadOptionalDecimal(dim, "widthCm"),
                    ReadOptionalDecimal(dim, "heightCm"),
                    ReadOptionalDecimal(dim, "depthCm"));
            }

            ProductOriginDto? origin = null;
            if (spec.TryGetProperty("origin", out var orig) && orig.ValueKind == JsonValueKind.Object)
            {
                origin = new ProductOriginDto(
                    ReadString(orig, "country"),
                    ReadString(orig, "region"),
                    ReadString(orig, "sourceLabel"));
            }

            var variants = new List<PackagingVariantDto>();
            if (spec.TryGetProperty("packagingVariants", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in arr.EnumerateArray())
                {
                    if (el.ValueKind != JsonValueKind.Object)
                        continue;
                    var unitType = ReadString(el, "unitType");
                    var qty = ReadOptionalDecimal(el, "quantity");
                    if (string.IsNullOrWhiteSpace(unitType) || !qty.HasValue || qty.Value <= 0)
                        continue;
                    var label = ReadString(el, "label");
                    var skuCode = ReadString(el, "skuCode");
                    var isDefault = el.TryGetProperty("isDefault", out var d) && d.ValueKind == JsonValueKind.True;
                    variants.Add(new PackagingVariantDto(unitType!, qty.Value, label, skuCode, isDefault));
                }
            }

            if (string.IsNullOrWhiteSpace(mou)
                && string.IsNullOrWhiteSpace(brand)
                && string.IsNullOrWhiteSpace(family)
                && string.IsNullOrWhiteSpace(model)
                && !unitsPerPack.HasValue
                && !shelfLifeDays.HasValue
                && dimensions is null
                && origin is null
                && variants.Count == 0)
                return null;

            return new ProductSpecDto(
                mou,
                variants,
                dimensions,
                unitsPerPack,
                shelfLifeDays,
                brand,
                family,
                model,
                origin);
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadString(JsonElement parent, string name)
    {
        if (!parent.TryGetProperty(name, out var el) || el.ValueKind != JsonValueKind.String)
            return null;
        var s = el.GetString()?.Trim();
        return string.IsNullOrEmpty(s) ? null : s;
    }

    private static int? ReadOptionalInt(JsonElement parent, string name)
    {
        var d = ReadOptionalDecimal(parent, name);
        if (!d.HasValue)
            return null;
        return (int)Math.Round(d.Value, MidpointRounding.AwayFromZero);
    }

    private static decimal? ReadOptionalDecimal(JsonElement parent, string name)
    {
        if (!parent.TryGetProperty(name, out var el) || el.ValueKind == JsonValueKind.Null)
            return null;
        if (el.ValueKind == JsonValueKind.Number)
        {
            if (el.TryGetDecimal(out var d))
                return d;
        }

        if (el.ValueKind == JsonValueKind.String)
        {
            var raw = el.GetString()?.Trim();
            if (string.IsNullOrEmpty(raw))
                return null;
            if (decimal.TryParse(raw, out var s))
                return s;
        }

        return null;
    }
}

public sealed record PackagingVariantDto(
    string UnitType,
    decimal Quantity,
    string? Label,
    string? SkuCode,
    bool IsDefault);

public sealed record ProductDimensionsDto(
    int? WeightGrams,
    decimal? WidthCm,
    decimal? HeightCm,
    decimal? DepthCm);

public sealed record ProductOriginDto(
    string? Country,
    string? Region,
    string? SourceLabel);

public sealed record ProductSpecDto(
    string? Mou,
    IReadOnlyList<PackagingVariantDto> PackagingVariants,
    ProductDimensionsDto? Dimensions,
    int? UnitsPerPack,
    int? ShelfLifeDays,
    string? Brand,
    string? ProductFamily,
    string? Model,
    ProductOriginDto? Origin);
