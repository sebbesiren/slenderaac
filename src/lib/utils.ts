import { faPaypal, faStripeS } from '@fortawesome/free-brands-svg-icons';
import { faCreditCard } from '@fortawesome/free-solid-svg-icons';

import { PUBLIC_TITLE } from '$env/static/public';

/**
 * Converts a string to proper case with spaces between words.
 * @param str The string to convert.
 * @returns The converted string.
 */
export function toProperCase(str: string) {
	return str
		.replace(/([A-Z])/g, (c) => ` ${c.toLowerCase()}`)
		.replace(/^./, (str) => str.toUpperCase());
}

/**
 * Capitalizes the first letter of each word in a string.
 * @param str The string to capitalize.
 * @returns The capitalized string.
 */
export function toTitleCase(str: string) {
	return str.replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
}

/**
 * Generates a browser title from a page title.
 * @param pageTitle The page title.
 * @returns The browser title.
 */
export function browserTitle(
	pageTitle: string,
	{ admin }: { admin: boolean } = { admin: false },
): string {
	return `${PUBLIC_TITLE}${admin ? ' | Admin' : ''}${
		pageTitle.length > 0 ? ' | ' : ''
	}${toTitleCase(pageTitle)}`;
}

/**
 * Deep merges two objects.
 * @param target The target object.
 * @param source The source object.
 * @returns The merged object.
 */
export function deepMerge<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	T extends Record<string, any>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	U extends Record<string, any>,
>(target: T, source: U): T & U {
	for (const key of Object.keys(source)) {
		if (source[key] instanceof Object)
			Object.assign(source[key], deepMerge(target[key], source[key]));
	}

	Object.assign(target || {}, source);
	return target as T & U;
}

/**
 * Formats a date string from bigint or number.
 * @param dateOrTimestamp The date string to format.
 * @returns The formatted date string.
 */
export function formatDate(dateOrTimestamp: Date | bigint | number | null) {
	if (dateOrTimestamp === null) return 'Never';
	if (typeof dateOrTimestamp === 'bigint')
		dateOrTimestamp = Number(dateOrTimestamp);
	if (dateOrTimestamp instanceof Date)
		dateOrTimestamp = dateOrTimestamp.getTime();
	if (dateOrTimestamp > 100000000000) dateOrTimestamp /= 1000;
	if (dateOrTimestamp === 0) return 'Never';

	return new Date(dateOrTimestamp * 1000).toLocaleString();
}

/**
 * Debounces a function.
 * @param func The function to debounce.
 * @param wait The time to wait before calling the function.
 * @returns The debounced function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	return function (this: unknown, ...args: Parameters<T>) {
		const later = function () {
			timeout = null;
			func(...args);
		};
		timeout && clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Parses a date from bigint or number (seconds or milliseconds) into a Date object.
 * @param timestamp The date value to parse.
 * @returns The parsed date.
 */
export function parseDate(timestamp: bigint | number) {
	if (typeof timestamp === 'bigint') timestamp = Number(timestamp);
	if (timestamp > 100000000000) timestamp /= 1000;

	return new Date(timestamp * 1000);
}

/**
 * Format currency to string.
 * @param amount The amount to format.
 * @param currency The currency to format to.
 * @returns The formatted currency string.
 */
export function formatCurrency(amount: number, currency: string) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
	}).format(amount);
}

/**
 * Groups an array of objects by a key.
 * @param array The array to group.
 * @param key The key to group by.
 * @returns The grouped array.
 */
export function groupBy<T extends Record<string, unknown>>(
	array: T[],
	key: keyof T,
): Record<string, T[]> {
	return array.reduce((result, currentValue) => {
		(result[currentValue[key] as string] ??= []).push(currentValue);
		return result;
	}, {} as Record<string, T[]>);
}

/**
 * Gets the sumbol for a currency.
 * @param currency The currency to get the symbol for.
 * @returns The currency symbol.
 */
export function getCurrencySymbol(currency: string) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
	}).formatToParts(1)[0].value;
}

/**
 * Get the faIcon for a payment method.
 * @param paymentMethod The payment method to get the faIcon for.
 * @returns The faIcon.
 */
export function getPaymentMethodIcon(paymentMethod: string) {
	switch (paymentMethod) {
		case 'paypal':
			return faPaypal;
		case 'stripe':
			return faStripeS;
		default:
			return faCreditCard;
	}
}
