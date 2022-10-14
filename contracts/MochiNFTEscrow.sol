// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Step
// User create a trade offer from discord
// 1 user click accept offer
// Create a thread
// open nft escrow link

// MARK: - Trade session init
// User A create trade offer with to address
// User B see the trade offer from user A

// MARK: - Send/Withdraw items to/from escrow
// User A send/withdraw nft items to/from escrow
// User B send/withdraw nft items to/from escrow

// MARK: - Lock phase
// User A check if items from B is correct, then lock
// User B check if items from A is correct, then lock

// MARK: - Finish
// After the last lock, item from escrow will be transfered to A and B

// MARK: - Note
// If there is any changes in lock phase, the lock will be unlock and user need to check again

// This version currently just support ERC721
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract MochiNFTEscrow is IERC721Receiver, Pausable, Ownable, ReentrancyGuard {
    struct TradeItem {
        uint256 tradeId;
        address tokenAddress;
        uint256 tokenId;
        bool exists;
    }

    struct TradeOffer {
        address from;
        address to;
        bool isFromLocked;
        bool isToLocked;
        bool isClosed;
    }

    TradeOffer[] public trades;
    TradeItem[] public tradeItems;

    // from/to address => tradeIds
    mapping(address => uint256[]) public userTrades;
    // tradeId => owner address => itemIds
    mapping(uint256 => mapping(address => uint256[])) public userTradingItems;

    event TradeCreated(
        uint256 indexed tradeId,
        address indexed from,
        address indexed to
    );
    event TradeCancelled(uint256 indexed tradeId, address indexed cancelUser);
    event TradeSuccess(
        uint256 indexed tradeId,
        address indexed from,
        address indexed to
    );

    event Deposit(uint256 indexed tradeId, address indexed user);
    event Withdraw(uint256 indexed tradeId, address indexed user);

    event Lock(uint256 indexed tradeId, address indexed user);
    event Unlock(uint256 indexed tradeId, address indexed user);

    constructor() {}

    modifier onlyRelevant(uint256 tradeId) {
        TradeOffer memory trade = trades[tradeId];
        require(
            msg.sender == trade.from || msg.sender == trade.to,
            "you are not buyer or seller"
        );
        _;
    }

    modifier whenTradeOpen(uint256 tradeId) {
        TradeOffer memory trade = trades[tradeId];
        require(trade.isClosed == false, "trade is closed");
        _;
    }

    modifier notContract() {
        require(!Address.isContract(msg.sender), "not allow contract");
        _;
    }

    function createTradeOffer(address to) external notContract whenNotPaused {
        trades.push(TradeOffer(msg.sender, to, false, false, false));
        uint256 tradeId = trades.length;
        userTrades[msg.sender].push(tradeId);
        userTrades[to].push(tradeId);
        emit TradeCreated(tradeId, msg.sender, to);
    }

    function cancelTradeOffer(uint256 tradeId)
        external
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
    {
        TradeOffer storage trade = trades[tradeId];
        _withdrawAll(tradeId, trade.from);
        _withdrawAll(tradeId, trade.to);
        trade.isClosed = true;
        emit TradeCancelled(tradeId, msg.sender);
    }

    function lockTrade(uint256 tradeId)
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
        nonReentrant
    {
        TradeOffer storage trade = trades[tradeId];
        if (msg.sender == trade.from) {
            trade.isFromLocked = true;
        } else {
            trade.isToLocked = true;
        }
        emit Lock(tradeId, msg.sender);
        // check if both locked, then swap items
        if (trade.isFromLocked && trade.isToLocked) {
            _swapItems(tradeId);
            // Finished, close the trade
            trade.isClosed = true;
            emit TradeSuccess(tradeId, trade.from, trade.to);
        }
    }

    function _swapItems(uint256 tradeId) internal {
        TradeOffer memory trade = trades[tradeId];
        // Send 'from' items to 'to' address
        uint256[] memory fromItemIds = userTradingItems[tradeId][trade.from];
        for (uint256 i = 0; i < fromItemIds.length; i++) {
            TradeItem memory item = tradeItems[fromItemIds[i]];
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                trade.to,
                item.tokenId
            );
        }
        // Send 'to' items to 'from' address
        uint256[] memory toItemIds = userTradingItems[tradeId][trade.from];
        for (uint256 i = 0; i < toItemIds.length; i++) {
            TradeItem memory item = tradeItems[fromItemIds[i]];
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                trade.from,
                item.tokenId
            );
        }
    }

    function unlockTrade(uint256 tradeId)
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
    {
        TradeOffer storage trade = trades[tradeId];
        if (msg.sender == trade.from) {
            trade.isFromLocked = false;
        } else {
            trade.isToLocked = false;
        }
        emit Unlock(tradeId, msg.sender);
    }

    function deposit(
        uint256 tradeId,
        address tokenAddress,
        uint256[] memory tokenIds
    )
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
    {
        uint256[] storage userTradingItemIds = userTradingItems[tradeId][
            msg.sender
        ];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );
            TradeItem memory item = TradeItem(
                tradeId,
                tokenAddress,
                tokenIds[i],
                true
            );
            tradeItems.push(item);
            userTradingItemIds.push(tradeItems.length - 1);
        }
        TradeOffer storage trade = trades[tradeId];
        if (trade.isToLocked) {
            trade.isToLocked = false;
            emit Unlock(tradeId, trade.to);
        }
        if (trade.isFromLocked) {
            trade.isFromLocked = false;
            emit Unlock(tradeId, trade.from);
        }
        emit Deposit(tradeId, msg.sender);
    }

    function withdraw(
        uint256 tradeId,
        address tokenAddress,
        uint256[] memory tokenIds
    )
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
        nonReentrant
    {
        uint256[] memory userTradingItemIds = userTradingItems[tradeId][
            msg.sender
        ];
        for (uint256 i = 0; i < userTradingItemIds.length; i++) {
            TradeItem storage item = tradeItems[i];
            if (!item.exists) continue;
            if (item.tokenAddress != tokenAddress) continue;
            if (!_contain(tokenIds, item.tokenId)) continue;
            IERC721(item.tokenAddress).approve(msg.sender, item.tokenId);
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                msg.sender,
                item.tokenId
            );
            item.exists = false;
        }
        emit Withdraw(tradeId, msg.sender);

        TradeOffer storage trade = trades[tradeId];
        if (trade.isFromLocked) {
            trade.isFromLocked = false;
            emit Unlock(tradeId, trade.from);
        }
        if (trade.isToLocked) {
            trade.isToLocked = false;
            emit Unlock(tradeId, trade.to);
        }
    }

    function withdrawAll(uint256 tradeId)
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
        nonReentrant
    {
        _withdrawAll(tradeId, msg.sender);
        TradeOffer storage trade = trades[tradeId];
        if (trade.isFromLocked) {
            trade.isFromLocked = false;
            emit Unlock(tradeId, trade.from);
        }
        if (trade.isToLocked) {
            trade.isToLocked = false;
            emit Unlock(tradeId, trade.to);
        }
    }

    function depositedItems(uint256 tradeId, address user)
        public
        view
        returns (TradeItem[] memory)
    {
        uint256[] memory itemIds = userTradingItems[tradeId][user];
        TradeItem[] memory items = new TradeItem[](itemIds.length);
        for (uint256 i = 0; i < itemIds.length; i++) {
            TradeItem memory tradeItem = tradeItems[i];
            items[i] = tradeItem;
        }
        return items;
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _contain(uint256[] memory list, uint256 element)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < list.length; i++) {
            if (element == list[i]) {
                return true;
            }
        }
        return false;
    }

    function _withdrawAll(uint256 tradeId, address to) internal {
        uint256[] memory userTradingItemIds = userTradingItems[tradeId][to];
        for (uint256 i = 0; i < userTradingItemIds.length; i++) {
            TradeItem memory item = tradeItems[i];
            if (!item.exists) continue;
            IERC721(item.tokenAddress).approve(msg.sender, item.tokenId);
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                to,
                item.tokenId
            );
            item.exists = false;
        }
        emit Withdraw(tradeId, to);
    }
}
