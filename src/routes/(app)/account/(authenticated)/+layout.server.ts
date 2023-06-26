import type { AccountInfo } from '$lib/accounts';
import { dbToPlayer, PlayerSelectForList } from '$lib/server/players';
import { prisma } from '$lib/server/prisma';
import { requireLogin } from '$lib/server/session';

import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals }) => {
	requireLogin(locals);
	const account = await prisma.accounts.findUniqueOrThrow({
		where: {
			id: locals.session?.accountId,
		},
		select: {
			email: true,
			creation: true,
			premdays: true,
			coins: true,
			coins_transferable: true,
			is_verified: true,
			token_secret: true,
			players: {
				select: PlayerSelectForList,
			},
			emailVerifications: {
				select: { new_email: true },
				orderBy: { created_at: 'desc' },
			},
		},
	});

	const characters = account.players.map(dbToPlayer);
	const accountInfo: AccountInfo = {
		email: account.email,
		createdAt: account.creation,
		coins: account.coins,
		coinsTransferable: account.coins_transferable,
		premiumDays: account.premdays,
		isVerified: account.is_verified,
		newEmail: account.emailVerifications[0]?.new_email ?? undefined,
		is2faEnabled: Boolean(account.token_secret),
		lastLogin: new Date(
			characters.reduce(
				(acc, cur) => Math.max(acc, cur.lastLogin?.getTime() ?? 0),
				0,
			),
		),
	};
	return {
		title: 'Account Management',
		characters,
		account: accountInfo,
	};
}) satisfies LayoutServerLoad;
