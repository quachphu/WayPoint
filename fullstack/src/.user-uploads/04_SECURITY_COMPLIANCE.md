# Security & compliance

The two sections below (§2 and §3) are not "nice to have if there's time." They cover the two ways this specific product can cause real harm (an agent that spends money on false pretenses, an agent that calls people without permission), and both are cheap to build in from the start and expensive to retrofit. Build them alongside the features they gate, not after.

## 1. Baseline application security

- **Auth**: short-lived tokens for the client (see `docs/03_API_INTEGRATION.md` §2.2 for the Vocal Bridge token pattern specifically); if the app has its own user accounts, standard session cookies or JWTs with short expiry are the right starting point, a fully custom OAuth provider isn't something this product needs to build from scratch.
- **Secrets**: every third-party key lives in the deployment platform's secret manager (see the checklist in `docs/03_API_INTEGRATION.md` §5), never in the repo, never in client-side code. The Sabre client secret and the Vocal Bridge API key are the two that matter most, both are capable of spending real money or placing real calls if leaked.
- **Payments**: if the payment-settling feature (`01_PRODUCT_BRIEF.md` §5, later phases) is built, use a test-mode processor (Stripe test keys) throughout early development, never handle or store a raw card number at any stage. Move to real payment processing only alongside a genuine PCI review, not as an incidental add-on to a feature branch.
- **PII**: trip data (names, travel dates, phone numbers) is real personal data starting with the first real test user, not just once the product is "launched." Don't log full request/response bodies containing it anywhere outside a properly access-controlled logging system, a local console during development is fine, a committed log file or an open dashboard is not.

## 2. Prompt injection through untrusted channels

This agent ingests content it does not control from three places, and all three need the same treatment: **a live phone call transcript** (a human on the other end of the line can say anything, including something that reads like an instruction), **a pasted email or uploaded document** (once the ticket-parsing later-phase feature is built), and **tool outputs generally** (a malformed or manipulated API response).

The rule: treat every one of these as data the agent reads, never as instructions the agent follows. Concretely:

- The system prompt for the orchestrator should say this explicitly, and the message that carries call-transcript content should be tagged/wrapped so the model can distinguish "this is what the other party on the call said" from "this is my instruction."
- **The `interrupt()` confirm-gate described in `docs/02_ARCHITECTURE.md` §4 is the real defense, not the prompt wording.** No matter what a call transcript, an email, or a tool response contains, no booking or charge executes without a separate, explicit user confirmation captured through the app's own UI or voice turn, never inferred from tool output. This means even a fully successful injection attempt ("the airline agent" claiming the traveler already approved a $4,000 upgrade) cannot actually spend money, it can only produce a proposal that still has to clear the same gate as any other proposal.
- Before the disruption or booking node executes, a lightweight sanity check is worth the few lines of code: does the proposed action's cost fall within a reasonable range of what was being discussed, does the destination/date match the trip on file. Flag anything that doesn't for extra confirmation rather than silently proceeding. Not a full anomaly-detection system, just a guard rail.

## 3. Outbound calling compliance (TCPA) — read this before the first test call

This is real US federal law, not a formality, and Vocal Bridge's own terms of service put the compliance obligation entirely on the developer: their ToS requires certifying that prior consent was obtained from anyone the agent calls, and explicitly disclaims Vocal Bridge's own liability for TCPA, TSR, or state-law violations arising from outbound calling use. The rest of this section is factual background, not legal advice, this is genuinely unsettled and fast-moving law and a real attorney should review this specific feature before it handles real user phone numbers at any real volume — but here's what's true as of mid-2026 and what it means for how to build the feature.

### 3.1 The core rule

The FCC's February 2024 declaratory ruling confirmed that AI-generated voices count as an "artificial voice" under the Telephone Consumer Protection Act, meaning outbound AI calls require the called party's prior consent, and statutory damages run $500 to $1,500 per call with no aggregate cap, enforced heavily through class-action litigation rather than only FCC action.

### 3.2 Two different calling patterns in this product, two different risk pictures

- **Agent calls the traveler** (a disruption notification): lower risk, it's the app's own user with an existing relationship. Get explicit consent at signup, a real checkbox describing that the app's AI assistant may call the traveler about their bookings, not language buried in a terms-of-service wall of text.
- **Agent calls a business on the traveler's behalf** (the airline, the hotel): genuinely less settled. The TCPA is fundamentally aimed at protecting consumers from unwanted calls from businesses, not the reverse, and case law here is actively moving (there's a live circuit split on whether consent for artificial-voice calls needs to be oral or written). Disclose AI involvement on every such call regardless, both because several states are moving toward universal AI-voice disclosure requirements and because it's the right thing to do for whoever answers the phone.

### 3.3 What to build, from the start

- **A hardcoded AI disclosure as the first thing said on every outbound call**, no exceptions, this is the `--outbound-greeting` configuration shown in `docs/03_API_INTEGRATION.md` §2.6. Something like: *"Hi, this is an AI assistant calling on behalf of [traveler name] regarding their travel booking."*
- **A consent flag on the user record** (a boolean plus a timestamp is a legitimate starting schema, it can grow later) captured at signup, checked before any call to that user's own number.
- **An explicit, documented consent basis during development and testing**: while the outbound-call flow is being built and tested against a stand-in number rather than a real airline call center (`docs/06_BUILD_PLAN.md`, closing notes), the consent in play is the development team's own phone number and their own informed participation, not a real, unconsenting third party. Keep that distinction explicit in how the test harness is described internally, it should never be ambiguous later which calls were real, consented user-facing calls and which were internal testing.
- **The real next milestone, not a someday item**: a consent database queryable at call time, DNC-list scrubbing, and an audit log of every call made with its disclosure and consent basis. This is what separates a product that survives a compliance audit from one that doesn't, and it's genuinely cheap to build once the call flow itself exists, treat it as part of Phase 4 or 5 in `docs/06_BUILD_PLAN.md`, not something deferred indefinitely.

### 3.4 What not to do, ever

- Don't place an outbound call to a real airline or hotel support line from an automated test, from manual QA, or from any walkthrough with an audience present. Beyond the compliance question, it won't behave predictably. `docs/06_BUILD_PLAN.md`'s closing notes cover the correct stand-in approach.
- Don't skip the disclosure line "temporarily" with a plan to add it later. It's one config value and it's the single most defensible thing about the whole outbound-calling feature, there's no version of this product where it's acceptable to ship without it.
