// Reactive State & Storage Store for SmartNiwas
const STORAGE_KEYS = {
    SETTINGS: 'smartniwasSettings',
    DEVICES: 'smartniwasDevices',
    CASHFLOW: 'smartniwasCashflowTasks',
    NOTES: 'familyNotes',
    AUTH: 'smartniwasPortalAuth'
};

const DEFAULT_SETTINGS = {
    portalPasscode: "1234",
    mqttHost: "wss://mqtt.smartniwas.com",
    mqttUser: "",
    mqttPass: "",
    cctvEnabled: false,
    nvrHost: "https://cctv.smartniwas.com",
    nvrUser: "",
    nvrPass: "",
    nvrChannels: "101,201"
};

const DEFAULT_DEVICES = {
    switches: [],
    sensors: []
};

const DEFAULT_CASHFLOW_TASKS = [
    {
        id: "task-101",
        title: "Electricity Bill",
        category: "Utility",
        amount: 3200,
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        recurrence: "Monthly",
        completed: false,
        lastCompletedDate: null
    },
    {
        id: "task-102",
        title: "Society Maintenance",
        category: "Contractual",
        amount: 4500,
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        recurrence: "Monthly",
        completed: false,
        lastCompletedDate: null
    },
    {
        id: "task-103",
        title: "High-Speed Fiber Internet",
        category: "Utility",
        amount: 1199,
        dueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        recurrence: "Monthly",
        completed: false,
        lastCompletedDate: null
    }
];

class StateStore {
    constructor() {
        this.listeners = new Map();
        this.loadState();
    }

    loadState() {
        try {
            this.settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || { ...DEFAULT_SETTINGS };
        } catch (e) {
            this.settings = { ...DEFAULT_SETTINGS };
        }

        // Enforce safe fallbacks
        if (!this.settings.portalPasscode) this.settings.portalPasscode = "1234";
        if (!this.settings.mqttHost) this.settings.mqttHost = "wss://mqtt.smartniwas.com";
        if (!this.settings.nvrHost) this.settings.nvrHost = "https://cctv.smartniwas.com";

        try {
            this.devices = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICES)) || { ...DEFAULT_DEVICES };
        } catch (e) {
            this.devices = { ...DEFAULT_DEVICES };
        }

        try {
            this.cashflowTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.CASHFLOW)) || [...DEFAULT_CASHFLOW_TASKS];
        } catch (e) {
            this.cashflowTasks = [...DEFAULT_CASHFLOW_TASKS];
        }

        try {
            this.notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
        } catch (e) {
            this.notes = [];
        }
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        this.emit('settings', this.settings);
    }

    saveDevices(newDevices) {
        this.devices = newDevices;
        localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(this.devices));
        this.emit('devices', this.devices);
    }

    saveCashflowTasks(tasks) {
        this.cashflowTasks = tasks;
        localStorage.setItem(STORAGE_KEYS.CASHFLOW, JSON.stringify(this.cashflowTasks));
        this.emit('cashflow', this.cashflowTasks);
    }

    saveNotes(notes) {
        this.notes = notes;
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(this.notes));
        this.emit('notes', this.notes);
    }

    isAuth() {
        return sessionStorage.getItem(STORAGE_KEYS.AUTH) === 'true';
    }

    setAuth(status) {
        if (status) {
            sessionStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        } else {
            sessionStorage.removeItem(STORAGE_KEYS.AUTH);
        }
        this.emit('auth', status);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }
}

export const state = new StateStore();
