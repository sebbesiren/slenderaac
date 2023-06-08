import {
	type CoinOffers,
	type CoinOrders,
	CoinOrderStatus,
} from '@prisma/client';
import { error, redirect } from '@sveltejs/kit';
import invariant from 'tiny-invariant';

import type { CoinOffer } from '$lib/coinOffers';
import { isStep, stepIsAtOrAfter } from '$lib/payments';
import { prisma } from '$lib/server/prisma';
import { requireLogin } from '$lib/server/session';
import { stripe } from '$lib/server/stripe';
import { formatCurrency, groupBy } from '$lib/utils';

import { PUBLIC_TITLE } from '$env/static/public';

import type { Actions, PageServerLoad } from '../$types';

const enabledPaymentMethods = [stripe ? 'stripe' : null].filter(
	Boolean,
) as string[];

export const load = (async ({ locals, url, depends }) => {
	depends('shop:order');

	requireLogin(locals);

	const offers = groupBy(
		(await prisma.coinOffers.findMany()).map(
			(offer): CoinOffer => ({
				id: offer.id,
				currency: offer.currency,
				amount: offer.amount,
				price: formatCurrency(offer.price.toNumber(), offer.currency),
			}),
		),
		'currency',
	);

	let step = url.searchParams.get('step') || 'selection';
	if (!isStep(step)) {
		step = 'selection';
	}
	invariant(isStep(step), 'Invalid step');

	const token =
		url.searchParams.get('token') || url.searchParams.get('payment_intent');
	const clientSecret =
		url.searchParams.get('clientSecret') ||
		url.searchParams.get('payment_intent_client_secret');
	const paymentMethod = url.searchParams.get('paymentMethod');
	if (
		stepIsAtOrAfter(step, 'payment') &&
		(!token ||
			!clientSecret ||
			typeof token !== 'string' ||
			typeof clientSecret !== 'string')
	) {
		throw error(422, { message: 'Invalid payment intent' });
	}

	const offerId = url.searchParams.get('offerId');
	if (step === 'payment') {
		if (!offerId || typeof offerId !== 'string') {
			throw error(422, { message: 'Invalid offer ID' });
		}
		if (!paymentMethod || typeof paymentMethod !== 'string') {
			throw error(422, { message: 'Invalid payment method' });
		}
	}

	let order: CoinOrders | null = null;
	if (step === 'confirmation') {
		invariant(token, 'No payment token found');
		order = await prisma.coinOrders.findUniqueOrThrow({
			where: { payment_token: token },
		});
	} else if (token) {
		order = await prisma.coinOrders.findUniqueOrThrow({
			where: { payment_token: token },
		});
		if (
			order.status !== CoinOrderStatus.PENDING &&
			order.status !== CoinOrderStatus.FAILED_ATTEMPT
		) {
			throw redirect(302, '/shop/coins');
		}
	}

	return {
		step,
		offers,
		enabledPaymentMethods,
		accountEmail: locals.email,
		offerId,
		token,
		clientSecret,
		paymentMethod,
		order: order && {
			status: order.status,
			amount: order.amount,
		},
	};
}) satisfies PageServerLoad;

export const actions = {
	createIntent: async ({ locals, request }) => {
		requireLogin(locals);
		invariant(locals.email, 'No email found in locals');
		invariant(locals.accountId, 'No accountId found in locals');

		const data = await request.formData();
		const offerId = data.get('offerId');
		const paymentMethod = data.get('paymentMethod');
		if (!offerId || typeof offerId !== 'string') {
			throw error(422, { message: 'Invalid offer ID' });
		}

		if (!paymentMethod || typeof paymentMethod !== 'string') {
			throw error(422, { message: 'Invalid payment method' });
		}

		if (!enabledPaymentMethods.includes(paymentMethod)) {
			throw error(422, { message: 'Invalid payment method' });
		}

		let clientSecret: string | null;
		let token: string | null;

		const offer = await prisma.coinOffers.findUniqueOrThrow({
			where: { id: offerId },
		});

		switch (paymentMethod) {
			case 'stripe':
				({ token, clientSecret } = await handleStripe(locals.email, offer));
				break;
			default:
				throw error(422, { message: 'Invalid payment method' });
		}

		invariant(token, 'No payment token found');
		invariant(clientSecret, 'No client secret found');

		await prisma.coinOrders.create({
			data: {
				account: { connect: { id: locals.accountId } },
				price: offer.price,
				currency: offer.currency,
				amount: offer.amount,
				status: CoinOrderStatus.PENDING,
				payment_token: token,
			},
		});

		throw redirect(
			302,
			`/shop/coins/?step=payment&paymentMethod=${paymentMethod}&token=${token}&clientSecret=${clientSecret}&offerId=${offerId}`,
		);
	},
} satisfies Actions;

async function handleStripe(accountEmail: string, offer: CoinOffers) {
	invariant(stripe, 'Stripe not enabled');

	const paymentIntent = await stripe.paymentIntents.create({
		amount: Number(offer.price.toString().replace('.', '')),
		currency: offer.currency.toLowerCase(),
		receipt_email: accountEmail,
		description: `Purchase of ${offer.amount} coins`,
		statement_descriptor: `${PUBLIC_TITLE} Coins`,
		automatic_payment_methods: {
			enabled: true,
		},
	});

	return { token: paymentIntent.id, clientSecret: paymentIntent.client_secret };
}
