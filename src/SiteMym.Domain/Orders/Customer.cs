using SiteMym.Domain.Common;

namespace SiteMym.Domain.Orders;

/// <summary>Отримувач посилки. Без реєстрації — просто ім'я й телефон.</summary>
public sealed record Customer
{
    private Customer(string fullName, string phone)
    {
        FullName = fullName;
        Phone = phone;
    }

    public string FullName { get; }

    /// <summary>Нормалізований номер: +380XXXXXXXXX.</summary>
    public string Phone { get; }

    public static Result<Customer> Create(string fullName, string phone)
    {
        var name = string.Join(' ', (fullName ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (name.Split(' ').Length < 2)
            return Result.Failure<Customer>(OrderErrors.FullNameRequired);

        var digits = new string((phone ?? string.Empty).Where(char.IsAsciiDigit).ToArray());
        if (digits.Length == 10 && digits.StartsWith('0'))
            digits = "38" + digits;
        if (digits.Length != 12 || !digits.StartsWith("380"))
            return Result.Failure<Customer>(OrderErrors.InvalidPhone);

        return new Customer(name, "+" + digits);
    }
}
