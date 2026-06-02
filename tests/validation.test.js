
const validateLogic = (body) => {
    const { name, arrival, departure, roomIds } = body;
    if (!name || name.length < 3) return "Укажите ФИО гостя";
    if (new Date(arrival) >= new Date(departure)) return "Дата выезда некорректна";
    if (!roomIds || roomIds.length === 0) return "Выберите места";
    return null; // Ошибок нет
};

describe('Бизнес-логика регистрации гостя', () => {
    test('Должен выдать ошибку, если имя слишком короткое', () => {
        const result = validateLogic({ name: 'Ив', arrival: '2023-01-01', departure: '2023-01-05', roomIds: [1] });
        expect(result).toBe("Укажите ФИО гостя");
    });

    test('Должен выдать ошибку, если дата выезда раньше заезда', () => {
        const result = validateLogic({ name: 'Иван Иванов', arrival: '2023-01-10', departure: '2023-01-05', roomIds: [1] });
        expect(result).toBe("Дата выезда некорректна");
    });

    test('Должен выдать ошибку, если не выбраны комнаты', () => {
        const result = validateLogic({ name: 'Иван Иванов', arrival: '2023-01-01', departure: '2023-01-05', roomIds: [] });
        expect(result).toBe("Выберите места");
    });

    test('Должен пройти валидацию при корректных данных', () => {
        const result = validateLogic({ name: 'Иван Иванов', arrival: '2023-01-01', departure: '2023-01-05', roomIds: [1] });
        expect(result).toBeNull();
    });
});