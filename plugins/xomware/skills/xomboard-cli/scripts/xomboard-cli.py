#!/usr/bin/env python3
"""
XomBoard CLI
Command-line interface for managing XomBoard kanban.
"""

import argparse
import sys
import json
from pathlib import Path

# Import from local lib
try:
    from xomboard_lib import XomBoardClient, create_default_config
except ImportError:
    print("Error: xomboard_lib.py not found. Make sure both scripts are in the same directory.")
    sys.exit(1)


def cmd_status(args, board: XomBoardClient):
    """Show board status."""
    status = board.get_status()
    
    print(f"XomBoard Status")
    print(f"Total cards: {status['total']}")
    print(f"\nBy column:")
    for column, count in status['by_column'].items():
        print(f"  {column}: {count}")
    
    return 0


def cmd_list(args, board: XomBoardClient):
    """List cards with optional filters."""
    cards = board.get_cards(
        column=args.column,
        assignee=args.assignee,
        label=args.label
    )
    
    if not cards:
        print("No cards found.")
        return 0
    
    print(f"Found {len(cards)} card(s):\n")
    for card in cards:
        print(f"[{card.get('column', 'Unknown')}] {card.get('title', 'Untitled')}")
        print(f"  ID: {card.get('id', card.get('number', 'N/A'))}")
        print(f"  Assignee: {card.get('assignee', 'Unassigned')}")
        if card.get('labels'):
            print(f"  Labels: {', '.join(card['labels'])}")
        print()
    
    return 0


def cmd_get(args, board: XomBoardClient):
    """Get details of a specific card."""
    card = board.get_card(args.card_id)
    
    if not card:
        print(f"Card {args.card_id} not found.")
        return 1
    
    print(json.dumps(card, indent=2))
    return 0


def cmd_move(args, board: XomBoardClient):
    """Move a card to a column."""
    if board.move_card(args.card_id, args.target_column, sync=True):
        print(f"Moved {args.card_id} to '{args.target_column}'")
        return 0
    else:
        print(f"Failed to move card {args.card_id}")
        return 1


def cmd_update(args, board: XomBoardClient):
    """Update card properties."""
    labels = args.labels.split(",") if args.labels else None
    
    if board.update_card(
        args.card_id,
        assignee=args.assignee,
        description=args.description,
        labels=labels,
        sync=True
    ):
        print(f"Updated {args.card_id}")
        return 0
    else:
        print(f"Failed to update card {args.card_id}")
        return 1


def cmd_sync(args, board: XomBoardClient):
    """Sync board to API and GitHub Projects."""
    if board.sync():
        print("Board synced successfully.")
        return 0
    else:
        print("Sync failed.")
        return 1


def cmd_init(args):
    """Initialize configuration."""
    config_path = args.config_path or Path.home() / ".xomboard" / "config.json"
    create_default_config(str(config_path))
    print(f"Configuration initialized at {config_path}")
    return 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        prog="xomboard",
        description="Manage XomBoard kanban from the command line"
    )
    
    parser.add_argument(
        "--config",
        default=None,
        help="Path to config file (default: ~/.xomboard/config.json)"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    subparsers.required = True
    
    # Status command
    subparsers.add_parser("status", help="Show board status")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List cards")
    list_parser.add_argument("--column", help="Filter by column")
    list_parser.add_argument("--assignee", help="Filter by assignee")
    list_parser.add_argument("--label", help="Filter by label")
    
    # Get command
    get_parser = subparsers.add_parser("get", help="Get card details")
    get_parser.add_argument("card_id", help="Card ID or issue number")
    
    # Move command
    move_parser = subparsers.add_parser("move", help="Move a card")
    move_parser.add_argument("card_id", help="Card ID or issue number")
    move_parser.add_argument("target_column", help="Target column name")
    
    # Update command
    update_parser = subparsers.add_parser("update", help="Update card properties")
    update_parser.add_argument("card_id", help="Card ID or issue number")
    update_parser.add_argument("--assignee", help="Set assignee")
    update_parser.add_argument("--description", help="Set description")
    update_parser.add_argument("--labels", help="Set labels (comma-separated)")
    
    # Sync command
    subparsers.add_parser("sync", help="Sync board to API")
    
    # Init command
    init_parser = subparsers.add_parser("init", help="Initialize configuration")
    init_parser.add_argument("--config", help="Path to config file")
    
    args = parser.parse_args()
    
    # Handle init command specially (no board needed)
    if args.command == "init":
        return cmd_init(args)
    
    # For all other commands, we need the board
    try:
        board = XomBoardClient(args.config)
    except FileNotFoundError:
        print("Error: Configuration file not found.")
        print("Run 'xomboard init' to create one.")
        return 1
    except Exception as e:
        print(f"Error initializing board: {e}")
        return 1
    
    # Dispatch to command handler
    handlers = {
        "status": cmd_status,
        "list": cmd_list,
        "get": cmd_get,
        "move": cmd_move,
        "update": cmd_update,
        "sync": cmd_sync,
    }
    
    handler = handlers.get(args.command)
    if handler:
        return handler(args, board)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
