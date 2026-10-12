using SiteMym.Domain.Common;

namespace SiteMym.Domain.Orders;

/// <summary>Відділення або поштомат Нової Пошти.</summary>
public sealed record DeliveryAddress
{
    private DeliveryAddress(string city, string branch)
    {
        City = city;
        Branch = branch;
    }

    public string City { get; }

    /// <summary>«№ 112, вул. Срібнокільська, 3»</summary>
    public string Branch { get; }

    public static Result<DeliveryAddress> Create(string city, string branch)
    {
        if (string.IsNullOrWhiteSpace(city))
            return Result.Failure<DeliveryAddress>(OrderErrors.CityRequired);
        if (string.IsNullOrWhiteSpace(branch))
            return Result.Failure<DeliveryAddress>(OrderErrors.BranchRequired);

        return new DeliveryAddress(city.Trim(), branch.Trim());
    }
}
