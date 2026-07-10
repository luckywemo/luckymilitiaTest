// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title LuckyMilitiaStats
 * @notice On-chain combat record registry for Lucky Militia on Base and Celo.
 * @dev Write access: owner, authorised relayer, or self-write EOA only.
 *      Per-match kill cap + cooldown prevent stat inflation.
 */
contract LuckyMilitiaStats {

    // ── Custom errors (cheaper than require strings) ──────────────────────────
    error NotOwner();
    error NotAuthorized();
    error AlreadyRegistered();
    error InvalidUsername();
    error PlayerNotRegistered();
    error InvalidWinCount();
    error KillCapExceeded();
    error CooldownActive();
    error ZeroAddress();
    error PlayerNotFound();

    // ── Structs ───────────────────────────────────────────────────────────────

    struct PlayerRecord {
        string   username;
        uint128  kills;
        uint128  wins;
        uint128  gamesPlayed;
        uint128  pvpKills;
        uint128  pvpWins;
        uint128  pveKills;
        uint128  pveWins;
        uint48   registeredAt;
        uint48   lastMatchAt;
        bool     exists;
    }

    // ── Events ────────────────────────────────────────────────────────────────

    event PlayerRegistered(address indexed player, string username, uint256 timestamp);
    event MatchRecorded(address indexed player, uint256 kills, uint256 wins, bool isPvp, uint256 score, uint256 timestamp);

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;
    mapping(address => PlayerRecord) public players;
    address[] public playerList;
    mapping(address => bool) public authorizedRelayers;
    mapping(address => uint256) public lastMatchRecordedAt;

    uint256 public constant PVP_KILL_POINTS    = 25;
    uint256 public constant PVP_WIN_POINTS     = 100;
    uint256 public constant PVE_KILL_POINTS    = 5;
    uint256 public constant PVE_WIN_POINTS     = 20;
    uint256 public constant MAX_KILLS_PER_MATCH = 100;
    uint256 public constant MATCH_COOLDOWN      = 60;

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorizedFor(address player) {
        if (
            msg.sender != owner &&
            !authorizedRelayers[msg.sender] &&
            !(msg.sender == tx.origin && msg.sender == player)
        ) revert NotAuthorized();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setAuthorizedRelayer(address relayer, bool authorized) external onlyOwner {
        authorizedRelayers[relayer] = authorized;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ── Registration ──────────────────────────────────────────────────────────

    function registerPlayer(address player, string calldata username) external onlyAuthorizedFor(player) {
        if (players[player].exists) revert AlreadyRegistered();
        uint256 ulen = bytes(username).length;
        if (ulen == 0 || ulen > 32) revert InvalidUsername();

        players[player] = PlayerRecord({
            username:     username,
            kills:        0,
            wins:         0,
            gamesPlayed:  0,
            pvpKills:     0,
            pvpWins:      0,
            pveKills:     0,
            pveWins:      0,
            registeredAt: uint48(block.timestamp),
            lastMatchAt:  0,
            exists:       true
        });

        playerList.push(player);
        emit PlayerRegistered(player, username, block.timestamp);
    }

    // ── Match recording ───────────────────────────────────────────────────────

    /**
     * @param isPvp  true = PvP match, false = PvE match
     */
    function recordMatchResult(
        address player,
        uint256 kills,
        uint256 wins,
        bool    isPvp
    ) external onlyAuthorizedFor(player) {
        if (!players[player].exists)                                   revert PlayerNotRegistered();
        if (wins > 1)                                                  revert InvalidWinCount();
        if (kills > MAX_KILLS_PER_MATCH)                               revert KillCapExceeded();
        if (block.timestamp < lastMatchRecordedAt[player] + MATCH_COOLDOWN) revert CooldownActive();

        lastMatchRecordedAt[player] = block.timestamp;
        PlayerRecord storage r = players[player];

        r.kills        += uint128(kills);
        r.wins         += uint128(wins);
        r.gamesPlayed  += 1;
        r.lastMatchAt   = uint48(block.timestamp);

        uint256 score;
        if (isPvp) {
            r.pvpKills += uint128(kills);
            r.pvpWins  += uint128(wins);
            score = kills * PVP_KILL_POINTS + wins * PVP_WIN_POINTS;
        } else {
            r.pveKills += uint128(kills);
            r.pveWins  += uint128(wins);
            score = kills * PVE_KILL_POINTS + wins * PVE_WIN_POINTS;
        }

        emit MatchRecorded(player, kills, wins, isPvp, score, block.timestamp);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    function getStats(address player) external view returns (
        string memory username,
        uint256 kills,
        uint256 wins,
        uint256 gamesPlayed,
        uint256 pvpKills,
        uint256 pvpWins,
        uint256 pveKills,
        uint256 pveWins,
        uint256 registeredAt,
        uint256 lastMatchAt
    ) {
        PlayerRecord storage r = players[player];
        if (!r.exists) revert PlayerNotFound();
        return (r.username, r.kills, r.wins, r.gamesPlayed,
                r.pvpKills, r.pvpWins, r.pveKills, r.pveWins,
                r.registeredAt, r.lastMatchAt);
    }

    function getPlayerCount() external view returns (uint256) {
        return playerList.length;
    }

    function isRegistered(address player) external view returns (bool) {
        return players[player].exists;
    }
}
