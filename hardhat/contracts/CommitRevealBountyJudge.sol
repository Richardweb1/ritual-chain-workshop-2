// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CommitRevealBountyJudge {
    uint256 public constant MAX_SUBMISSIONS = 100;
    uint256 public constant MAX_ANSWER_LENGTH = 4_000;

    uint256 public nextBountyId = 1;

    struct RevealedSubmission {
        address submitter;
        string answer;
    }

    struct CommitmentRecord {
        bytes32 commitment;
        bool revealed;
        uint256 submissionIndex;
    }

    struct Bounty {
        address owner;
        string title;
        string rubric;
        uint256 reward;
        uint256 submissionDeadline;
        uint256 commitmentCount;
        bool judged;
        bool finalized;
        bytes aiReview;
        uint256 winnerIndex;
        RevealedSubmission[] submissions;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => mapping(address => CommitmentRecord)) private commitments;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed owner,
        string title,
        uint256 reward,
        uint256 submissionDeadline
    );

    event CommitmentSubmitted(
        uint256 indexed bountyId,
        address indexed submitter,
        bytes32 commitment
    );

    event AnswerRevealed(
        uint256 indexed bountyId,
        uint256 indexed submissionIndex,
        address indexed submitter
    );

    event AllAnswersJudged(uint256 indexed bountyId, bytes aiReview);

    event WinnerFinalized(
        uint256 indexed bountyId,
        uint256 indexed winnerIndex,
        address indexed winner,
        uint256 reward
    );

    modifier bountyExists(uint256 bountyId) {
        require(bounties[bountyId].owner != address(0), "bounty not found");
        _;
    }

    modifier onlyOwner(uint256 bountyId) {
        require(msg.sender == bounties[bountyId].owner, "not bounty owner");
        _;
    }

    function createBounty(
        string calldata title,
        string calldata rubric,
        uint256 submissionDeadline
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "reward required");
        require(submissionDeadline > block.timestamp, "deadline must be future");

        bountyId = nextBountyId++;

        Bounty storage bounty = bounties[bountyId];
        bounty.owner = msg.sender;
        bounty.title = title;
        bounty.rubric = rubric;
        bounty.reward = msg.value;
        bounty.submissionDeadline = submissionDeadline;
        bounty.winnerIndex = type(uint256).max;

        emit BountyCreated(bountyId, msg.sender, title, msg.value, submissionDeadline);
    }

    function submitCommitment(
        uint256 bountyId,
        bytes32 commitment
    ) external bountyExists(bountyId) {
        Bounty storage bounty = bounties[bountyId];
        CommitmentRecord storage record = commitments[bountyId][msg.sender];

        require(block.timestamp < bounty.submissionDeadline, "submission phase closed");
        require(!bounty.judged, "already judged");
        require(!bounty.finalized, "already finalized");
        require(bounty.commitmentCount < MAX_SUBMISSIONS, "too many submissions");
        require(commitment != bytes32(0), "empty commitment");
        require(record.commitment == bytes32(0), "already committed");

        record.commitment = commitment;
        record.submissionIndex = type(uint256).max;
        bounty.commitmentCount++;

        emit CommitmentSubmitted(bountyId, msg.sender, commitment);
    }

    function revealAnswer(
        uint256 bountyId,
        string calldata answer,
        bytes32 salt
    ) external bountyExists(bountyId) {
        Bounty storage bounty = bounties[bountyId];
        CommitmentRecord storage record = commitments[bountyId][msg.sender];

        require(block.timestamp >= bounty.submissionDeadline, "reveal phase not started");
        require(!bounty.judged, "already judged");
        require(!bounty.finalized, "already finalized");
        require(record.commitment != bytes32(0), "no commitment");
        require(!record.revealed, "already revealed");
        require(bytes(answer).length <= MAX_ANSWER_LENGTH, "answer too long");
        require(
            computeCommitment(bountyId, answer, salt, msg.sender) == record.commitment,
            "invalid reveal"
        );

        bounty.submissions.push(RevealedSubmission({submitter: msg.sender, answer: answer}));
        record.revealed = true;
        record.submissionIndex = bounty.submissions.length - 1;

        emit AnswerRevealed(bountyId, bounty.submissions.length - 1, msg.sender);
    }

    function judgeAll(
        uint256 bountyId,
        bytes calldata llmInput
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(block.timestamp >= bounty.submissionDeadline, "submission phase open");
        require(!bounty.judged, "already judged");
        require(!bounty.finalized, "already finalized");
        require(bounty.submissions.length > 0, "no revealed submissions");
        require(llmInput.length > 0, "empty llm input");

        bounty.judged = true;
        bounty.aiReview = llmInput;

        emit AllAnswersJudged(bountyId, llmInput);
    }

    function finalizeWinner(
        uint256 bountyId,
        uint256 winnerIndex
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(bounty.judged, "not judged yet");
        require(!bounty.finalized, "already finalized");
        require(winnerIndex < bounty.submissions.length, "invalid winner");

        bounty.finalized = true;
        bounty.winnerIndex = winnerIndex;

        address winner = bounty.submissions[winnerIndex].submitter;
        uint256 reward = bounty.reward;
        bounty.reward = 0;

        (bool ok, ) = payable(winner).call{value: reward}("");
        require(ok, "payment failed");

        emit WinnerFinalized(bountyId, winnerIndex, winner, reward);
    }

    function getBounty(
        uint256 bountyId
    )
        external
        view
        bountyExists(bountyId)
        returns (
            address owner,
            string memory title,
            string memory rubric,
            uint256 reward,
            uint256 submissionDeadline,
            uint256 commitmentCount,
            bool judged,
            bool finalized,
            uint256 revealedCount,
            uint256 winnerIndex,
            bytes memory aiReview
        )
    {
        Bounty storage bounty = bounties[bountyId];
        return (
            bounty.owner,
            bounty.title,
            bounty.rubric,
            bounty.reward,
            bounty.submissionDeadline,
            bounty.commitmentCount,
            bounty.judged,
            bounty.finalized,
            bounty.submissions.length,
            bounty.winnerIndex,
            bounty.aiReview
        );
    }

    function getSubmission(
        uint256 bountyId,
        uint256 index
    )
        external
        view
        bountyExists(bountyId)
        returns (address submitter, string memory answer)
    {
        Bounty storage bounty = bounties[bountyId];
        require(index < bounty.submissions.length, "invalid index");

        RevealedSubmission storage submission = bounty.submissions[index];
        return (submission.submitter, submission.answer);
    }

    function getCommitment(
        uint256 bountyId,
        address submitter
    )
        external
        view
        bountyExists(bountyId)
        returns (bytes32 commitment, bool revealed, uint256 submissionIndex)
    {
        CommitmentRecord storage record = commitments[bountyId][submitter];
        return (record.commitment, record.revealed, record.submissionIndex);
    }

    function computeCommitment(
        uint256 bountyId,
        string calldata answer,
        bytes32 salt,
        address submitter
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(answer, salt, submitter, bountyId));
    }
}
