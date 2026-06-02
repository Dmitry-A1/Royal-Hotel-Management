const calculateDays = (arrival, departure) => {
    const diff = Math.ceil(Math.abs(new Date(departure) - new Date(arrival)) / (1000 * 60 * 60 * 24));
    return diff || 1;
};

describe('Расчет параметров проживания', () => {
    test('Правильно считает разницу в 3 дня', () => {
        expect(calculateDays('2023-10-01', '2023-10-04')).toBe(3);
    });

    test('Если заезд и выезд в один день, должен вернуть 1 день', () => {
        expect(calculateDays('2023-10-01', '2023-10-01')).toBe(1);
    });
});