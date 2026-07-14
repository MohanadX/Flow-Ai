import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing -
}

export function getUserProjectsChannel(email: string): string {
  return `projects-user-${email.toLowerCase()}`;
}

export const generatePagination = (currentPage: number, totalPages: number) => {
	// Validate inputs
	if (totalPages < 1) return [];
	if (currentPage < 1) currentPage = 1;
	if (currentPage > totalPages) currentPage = totalPages;

	// If the total number of pages is 7 or less,
	// display all pages without any ellipsis.
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	// If the current page is among the first 3 pages,
	// show the first 3, an ellipsis, and the last 2 pages.
	if (currentPage <= 3) {
		return [1, 2, 3, "...", totalPages - 1, totalPages];
	}

	// If the current page is among the last 3 pages,
	// show the first 2, an ellipsis, and the last 3 pages.
	if (currentPage >= totalPages - 2) {
		return [1, 2, "...", totalPages - 2, totalPages - 1, totalPages];
	}
	// [1,2,"...",8,9,10]

	// If the current page is somewhere in the middle,
	// show the first page, an ellipsis, the current page and its neighbors,
	// another ellipsis, and the last page.
	// [1,"...",4,5,6,"...",10]
	return [
		1,
		"...",
		currentPage - 1,
		currentPage,
		currentPage + 1,
		"...",
		totalPages,
	];
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): T & { cancel: () => void } {
    let inThrottle = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: ThisParameterType<T> | null = null;

    const throttled = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            
            const runTimeout = () => {
                timeoutId = setTimeout(() => {
                    if (lastArgs) {
                        // Invoke trailing call with the latest arguments and context
                        func.apply(lastThis!, lastArgs);
                        lastArgs = null;
                        lastThis = null;
                        // Restart the throttle window for the trailing invocation
                        runTimeout();
                    } else {
                        inThrottle = false;
                        timeoutId = null;
                    }
                }, limit);
            };
            
            runTimeout();
        } else {
            // Retain the latest arguments and context for trailing execution
            lastArgs = args;
			// eslint-disable-next-line @typescript-eslint/no-this-alias
            lastThis = this;
        }
    } as unknown as T & { cancel: () => void };

    throttled.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        lastArgs = null;
        lastThis = null;
        inThrottle = false;
    };

    return throttled;
}