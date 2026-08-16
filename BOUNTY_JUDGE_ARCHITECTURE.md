# Privacy-Preserving AI Bounty Judge Architecture

## Commit-Reveal Lifecycle

The homework contract is `hardhat/contracts/CommitRevealBountyJudge.sol`. It implements the required
portable EVM commit-reveal flow:

1. The bounty owner creates a bounty with a reward, rubric, and submission deadline.
2. During the submission phase, participants call `submitCommitment(bountyId, commitment)`.
3. The commitment is `keccak256(abi.encode(answer, salt, msg.sender, bountyId))`.
4. After the deadline, participants call `revealAnswer(bountyId, answer, salt)`.
5. The contract recomputes the hash and stores the plaintext answer only when it matches.
6. The owner calls `judgeAll(bountyId, llmInput)` once with the batch judging payload or result.
7. The owner calls `finalizeWinner(bountyId, winnerIndex)` to pay one valid revealed submitter.

Unrevealed commitments are public proof that someone submitted during the deadline, but they are not
eligible for judging.

## What Is Public

- Bounty owner, title, rubric, reward, and submission deadline.
- Participant addresses that committed.
- Commitment hashes.
- Revealed answers and salts after participants reveal.
- Final AI review bytes and selected winner index.

## What Stays Hidden

Before the reveal phase, plaintext answers and salts stay off-chain with the participant. The chain
stores only a hash, so other participants cannot copy or improve someone else's answer during the
submission window. If a participant never reveals, their plaintext answer never becomes part of the
judged submission set.

## Ritual-Native Hidden Submissions

A stronger Ritual-native version would avoid public reveals before judging. Participants would
encrypt answers off-chain to a Ritual TEE-controlled key and store ciphertexts or content-addressed
payloads off-chain. On-chain storage would keep only bounty metadata, submitter addresses,
ciphertext hashes or pointers, and payout state. Plaintext answers would exist on the participant's
device before submission and inside the Ritual TEE during the batch judging step. The TEE would
decrypt all eligible submissions, build one batch prompt for the LLM, and return a signed judging
result or compact review to the contract. This keeps the LLM call batched and avoids one call per
answer while preventing competitors from reading submissions before judging completes.

## Test Plan

The Hardhat tests in `hardhat/test/CommitRevealBountyJudge.ts` cover:

- commitment storage without plaintext exposure;
- rejection when reveal happens before the deadline;
- rejection for wrong salt;
- rejection when a different sender tries to reveal another account's commitment;
- successful reveal, `judgeAll`, and `finalizeWinner` for a valid revealed answer.

Run:

```bash
cd hardhat
pnpm exec hardhat test
```

## Reflection

The bounty rules, reward, deadline, and final payout should be public because participants need a
verifiable process before they spend time submitting. Answers should stay hidden during the
competitive phase so people cannot copy another participant's idea and submit a slightly improved
version. Salts must stay private until reveal because they are what make the commitment hard to
guess. AI should help compare many valid revealed answers against the rubric in a consistent batch.
A human should still make or confirm the final winner when there are subjective, ethical, or
contextual tradeoffs. The smart contract should enforce deadlines, commitment validity, eligibility,
and payment so the process cannot be quietly changed after submissions arrive. A stronger
TEE-backed design should reveal only the minimum information needed to audit the outcome.
