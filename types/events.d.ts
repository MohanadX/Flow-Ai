export {};

declare global {
    interface WindowEventMap {
        "open-starter-templates": CustomEvent<undefined>;
    }
}