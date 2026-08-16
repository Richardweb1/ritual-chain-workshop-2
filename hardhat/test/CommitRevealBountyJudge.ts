import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { encodeAbiParameters, keccak256, parseEther, stringToHex } from "viem";

const salt = stringToHex("private salt", { size: 32 });
const wrongSalt = stringToHex("wrong salt", { size: 32 });

function makeCommitment(
  bountyId: bigint,
  answer: string,
  saltValue: `0x${string}`,
  submitter: `0x${string}`,
) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "string" },
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
      ],
      [answer, saltValue, submitter, bountyId],
    ),
  );
}

describe("CommitRevealBountyJudge", async function () {
  const connection = await network.create();
  const { viem, networkHelpers } = connection;
  const publicClient = await viem.getPublicClient();
  const [owner, participant, other] = await viem.getWalletClients();

  async function deployBounty() {
    const judge = await viem.deployContract("CommitRevealBountyJudge");
    const block = await publicClient.getBlock();
    const deadline = block.timestamp + 3600n;

    await judge.write.createBounty(["Privacy bounty", "Pick the best technical answer", deadline], {
      account: owner.account,
      value: parseEther("1"),
    });

    return { judge, bountyId: 1n, deadline };
  }

  it("stores only the commitment hash during the submission phase", async function () {
    const { judge, bountyId } = await deployBounty();
    const answer = "Use commit-reveal so nobody can copy the answer early.";
    const commitment = makeCommitment(bountyId, answer, salt, participant.account.address);

    await judge.write.submitCommitment([bountyId, commitment], {
      account: participant.account,
    });

    const bounty = await judge.read.getBounty([bountyId]);
    assert.equal(bounty[5], 1n);
    assert.equal(bounty[8], 0n);

    const stored = await judge.read.getCommitment([bountyId, participant.account.address]);
    assert.equal(stored[0], commitment);
    assert.equal(stored[1], false);
  });

  it("rejects reveals before the submission deadline", async function () {
    const { judge, bountyId } = await deployBounty();
    const answer = "Reveal after the deadline.";
    const commitment = makeCommitment(bountyId, answer, salt, participant.account.address);

    await judge.write.submitCommitment([bountyId, commitment], {
      account: participant.account,
    });

    await assert.rejects(
      judge.write.revealAnswer([bountyId, answer, salt], {
        account: participant.account,
      }),
      /reveal phase not started/,
    );
  });

  it("rejects a reveal with the wrong salt or sender", async function () {
    const { judge, bountyId } = await deployBounty();
    const answer = "The original answer.";
    const commitment = makeCommitment(bountyId, answer, salt, participant.account.address);

    await judge.write.submitCommitment([bountyId, commitment], {
      account: participant.account,
    });
    await networkHelpers.time.increase(3601);

    await assert.rejects(
      judge.write.revealAnswer([bountyId, answer, wrongSalt], {
        account: participant.account,
      }),
      /invalid reveal/,
    );

    await assert.rejects(
      judge.write.revealAnswer([bountyId, answer, salt], {
        account: other.account,
      }),
      /no commitment/,
    );
  });

  it("judges and finalizes only valid revealed answers", async function () {
    const { judge, bountyId } = await deployBounty();
    const answer = "Batch valid revealed answers into one AI judging input.";
    const commitment = makeCommitment(bountyId, answer, salt, participant.account.address);

    await judge.write.submitCommitment([bountyId, commitment], {
      account: participant.account,
    });
    await networkHelpers.time.increase(3601);

    await judge.write.revealAnswer([bountyId, answer, salt], {
      account: participant.account,
    });

    await judge.write.judgeAll([bountyId, stringToHex("winnerIndex:0")], {
      account: owner.account,
    });
    await judge.write.finalizeWinner([bountyId, 0n], {
      account: owner.account,
    });

    const bounty = await judge.read.getBounty([bountyId]);
    assert.equal(bounty[6], true);
    assert.equal(bounty[7], true);
    assert.equal(bounty[8], 1n);
    assert.equal(bounty[9], 0n);
  });
});
