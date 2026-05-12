namespace Commerce.Api.Catalog;

public static class CatalogProductGallerySplit
{
    public static bool IsColorRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return false;
        return role.Equals("color", StringComparison.OrdinalIgnoreCase)
            || role.Equals("colour", StringComparison.OrdinalIgnoreCase)
            || role.Equals("swatch", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Splits product-level gallery rows into angle/variant rail vs color/swatch rail.
    /// When every row is classified as color, treats them as angles so the main stage still has imagery.
    /// </summary>
    public static (List<ProductGalleryImageDto> Angles, List<ProductGalleryImageDto> Colors) Split(
        IReadOnlyList<ProductGalleryImageDto> orderedGallery)
    {
        var angles = new List<ProductGalleryImageDto>();
        var colors = new List<ProductGalleryImageDto>();
        foreach (var g in orderedGallery)
        {
            if (IsColorRole(g.Role))
                colors.Add(g);
            else
                angles.Add(g);
        }

        if (angles.Count == 0 && colors.Count > 0)
        {
            angles.AddRange(colors);
            colors.Clear();
        }

        return (angles, colors);
    }
}
