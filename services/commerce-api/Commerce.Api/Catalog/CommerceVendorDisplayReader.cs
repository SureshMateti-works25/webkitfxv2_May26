using System.Text.Json;

namespace Commerce.Api.Catalog;

/// <summary>Reads optional storefront display vendor code from <c>Product.CommerceJson</c>.</summary>
public static class CommerceVendorDisplayReader
{
    /// <summary>
    /// Prefers <c>vendor.vendorCode</c>, then <c>vendor.outletCode</c>, then <c>merchandising.vendorCode</c>.
    /// When JSON has no code, falls back to <paramref name="vendorPortalUserId"/> (portal user id) if set.
    /// </summary>
    /// <summary>Prefers <c>vendor.displayName</c>, then <c>vendor.businessName</c>.</summary>
    public static string? ResolveVendorDisplayName(string? commerceJson)
    {
        if (string.IsNullOrWhiteSpace(commerceJson))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(commerceJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return null;

            if (doc.RootElement.TryGetProperty("vendor", out var v) && v.ValueKind == JsonValueKind.Object)
            {
                var dn = ReadString(v, "displayName");
                if (!string.IsNullOrWhiteSpace(dn))
                    return dn.Trim();
                var biz = ReadString(v, "businessName");
                if (!string.IsNullOrWhiteSpace(biz))
                    return biz.Trim();
            }
        }
        catch
        {
            /* ignore */
        }

        return null;
    }

    public static string? ResolveVendorCode(string? commerceJson, string? vendorPortalUserId)
    {
        var fromJson = TryReadFromCommerce(commerceJson);
        if (!string.IsNullOrWhiteSpace(fromJson))
            return fromJson.Trim();

        return string.IsNullOrWhiteSpace(vendorPortalUserId) ? null : vendorPortalUserId.Trim();
    }

    private static string? TryReadFromCommerce(string? commerceJson)
    {
        if (string.IsNullOrWhiteSpace(commerceJson))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(commerceJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return null;

            if (doc.RootElement.TryGetProperty("vendor", out var v) && v.ValueKind == JsonValueKind.Object)
            {
                var code = ReadString(v, "vendorCode");
                if (!string.IsNullOrWhiteSpace(code))
                    return code;
                var outlet = ReadString(v, "outletCode");
                if (!string.IsNullOrWhiteSpace(outlet))
                    return outlet;
            }

            if (doc.RootElement.TryGetProperty("merchandising", out var m) && m.ValueKind == JsonValueKind.Object)
            {
                var mc = ReadString(m, "vendorCode");
                if (!string.IsNullOrWhiteSpace(mc))
                    return mc;
            }
        }
        catch
        {
            /* ignore */
        }

        return null;
    }

    private static string? ReadString(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.String)
            return null;
        return p.GetString()?.Trim();
    }
}
