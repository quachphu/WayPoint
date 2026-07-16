import { buildSFTrip, seedConversation } from './_helpers/seed';

// A fully planned, confirmed weekend in SF with a realistic conversation history.
// The first traveler to open the app claims it. The default first impression.
export async function weekendPlanned() {
  const { tripId } = await buildSFTrip();
  await seedConversation(tripId, [
    { role: 'user', text: 'Plan me a weekend in San Francisco this weekend.', source: 'voice' },
    { role: 'agent', text: 'On it. I found a nonstop out Friday evening on Delta and put you at the Hotel Zephyr by the water. I lined up a couple of things to do too.' },
    { role: 'user', text: 'Perfect, book all of it.', source: 'voice' },
    { role: 'agent', text: 'Done, everything is confirmed. You fly out Friday at 5:30 and head home Sunday evening. Have a great trip.' },
  ]);
}
