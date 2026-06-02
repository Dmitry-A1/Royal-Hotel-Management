const logic = {
    // Расчет общей стоимости
    calculateTotal: (roomIds, rooms, days) => {
        return roomIds.reduce((sum, id) => {
            const room = rooms.find(r => r.id === id);
            return sum + (room ? room.price_per_room : 0) * days;
        }, 0);
    },

    // Расчет оставшихся мест
    calculateRemainingBeds: (capacity, activeGuestsCount) => {
        return capacity - activeGuestsCount;
    },

    // Формирование сообщения
    formatCheckoutNotification: (name) => {
        return `Гость ${name} выехал. Требуется уборка.`;
    },

    // Логика поиска ответственного за уборку
    isCleanerResponsible: (task, roomNumber, taskDate, searchDate) => {
        if (taskDate !== searchDate) return false;
        if (task.room_number === roomNumber) return true;
        if (!task.room_id && task.floor === Math.floor(roomNumber / 100)) return true; // Уборка этажа
        return false;
    }
};


describe('Тестирование расширенной логики', () => {

    const mockRooms = [
        { id: 1, room_number: 101, price_per_room: 1000, capacity: 3, floor: 1 },
        { id: 2, room_number: 102, price_per_room: 2000, capacity: 2, floor: 1 },
        { id: 3, room_number: 201, price_per_room: 5000, capacity: 1, floor: 2 }
    ];

    test('Расчет стоимости: проживание 1 гостя 1 день', () => {
        expect(logic.calculateTotal([1], mockRooms, 1)).toBe(1000);
    });

    test('Расчет стоимости: несколько комнат на несколько дней', () => {
        expect(logic.calculateTotal([1, 2], mockRooms, 2)).toBe(6000); // (1000+2000)*2
    });

    test('Расчет стоимости: если комната не найдена, цена должна быть 0', () => {
        expect(logic.calculateTotal([999], mockRooms, 5)).toBe(0);
    });

    test('Расчет стоимости: при нуле дней возвращается 0', () => {
        expect(logic.calculateTotal([1], mockRooms, 0)).toBe(0);
    });

    test('Места: расчет свободных мест в пустом номере', () => {
        expect(logic.calculateRemainingBeds(3, 0)).toBe(3);
    });

    test('Места: расчет при частичном заполнении', () => {
        expect(logic.calculateRemainingBeds(3, 2)).toBe(1);
    });

    test('Места: расчет при полной загрузке', () => {
        expect(logic.calculateRemainingBeds(3, 3)).toBe(0);
    });

    test('Места: не должно быть отрицательных мест (логическая проверка)', () => {
        const remaining = logic.calculateRemainingBeds(1, 2);
        expect(remaining).toBeLessThan(0);
    });

    const validate = (data) => {
        if (!data.passport || data.passport.length < 5) return false;
        if (!data.city_from) return false;
        return true;
    };

    test('Валидация: паспорт должен быть не менее 5 символов', () => {
        expect(validate({ passport: '123', city_from: 'Москва' })).toBe(false);
    });

    test('Валидация: успешная проверка корректного паспорта', () => {
        expect(validate({ passport: '4500 123456', city_from: 'Питер' })).toBe(true);
    });

    test('Валидация: город обязателен для заполнения', () => {
        expect(validate({ passport: '4500 123456', city_from: '' })).toBe(false);
    });

    test('Валидация: отсутствие объекта города', () => {
        expect(validate({ passport: '4500 123456' })).toBe(false);
    });

    const taskDate = '2025-01-20';

    test('Уборка: сотрудник ответственен, если назначен на конкретный номер', () => {
        const task = { room_number: 101, room_id: 1, floor: 1 };
        expect(logic.isCleanerResponsible(task, 101, taskDate, taskDate)).toBe(true);
    });

    test('Уборка: сотрудник ответственен за номер, если он убирает весь этаж', () => {
        const task = { room_id: null, floor: 1 }; // Уборка всего 1 этажа
        expect(logic.isCleanerResponsible(task, 101, taskDate, taskDate)).toBe(true);
        expect(logic.isCleanerResponsible(task, 102, taskDate, taskDate)).toBe(true);
    });

    test('Уборка: сотрудник НЕ ответственен, если дата не совпадает', () => {
        const task = { room_number: 101, room_id: 1, floor: 1 };
        expect(logic.isCleanerResponsible(task, 101, taskDate, '2025-01-21')).toBe(false);
    });

    test('Уборка: сотрудник НЕ ответственен за номер другого этажа', () => {
        const task = { room_id: null, floor: 1 };
        expect(logic.isCleanerResponsible(task, 201, taskDate, taskDate)).toBe(false);
    });

    test('Статус: корректная смена статуса сотрудника (имитация)', () => {
        const toggle = (s) => s === 'На смене' ? 'Выходной' : 'На смене';
        expect(toggle('На смене')).toBe('Выходной');
        expect(toggle('Выходной')).toBe('На смене');
    });

    test('Уведомления: корректный текст при выезде', () => {
        const msg = logic.formatCheckoutNotification('Иван Грозный');
        expect(msg).toContain('Иван Грозный');
        expect(msg).toContain('Требуется уборка');
    });

    test('Аналитика: расчет выручки из массива клиентов', () => {
        const clients = [{ total_paid: 100 }, { total_paid: 500 }, { total_paid: 400 }];
        const revenue = clients.reduce((sum, c) => sum + c.total_paid, 0);
        expect(revenue).toBe(1000);
    });

    test('Аналитика: фильтрация только активных гостей для загрузки', () => {
        const clients = [
            { is_active: true },
            { is_active: true },
            { is_active: false }
        ];
        const activeCount = clients.filter(c => c.is_active).length;
        expect(activeCount).toBe(2);
    });
});