#!/usr/bin/env python3
"""
XomBoard Python Library
Programmatic management of XomBoard kanban.
"""

import json
import os
import requests
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any


class XomBoardClient:
    """Client for XomBoard API and GitHub Projects integration."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize XomBoard client with config file."""
        if config_path is None:
            config_path = os.path.expanduser("~/.xomboard/config.json")
        
        self.config_path = config_path
        self.config = self._load_config()
        self.api_base = self.config.get("api_base", "https://api.xomware.com")
        self.api_auth_hash = self.config.get("api_auth_hash")
        self.github_token = self.config.get("github_token")
        self.project_id = self.config.get("project_id")
        self.board_owner = self.config.get("board_owner", "Xomware")
        self.status_field_id = self.config.get("status_field_id")
        self.columns = self.config.get("columns", {})
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        with open(self.config_path, "r") as f:
            return json.load(f)
    
    def _get_api_headers(self) -> Dict[str, str]:
        """Get headers for XomBoard API."""
        return {
            "X-Auth-Hash": self.api_auth_hash,
            "Content-Type": "application/json"
        }
    
    def _get_gh_headers(self) -> Dict[str, str]:
        """Get headers for GitHub API."""
        return {
            "Authorization": f"Bearer {self.github_token}",
            "Content-Type": "application/json",
            "X-Github-Api-Version": "2022-11-28"
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get board status summary."""
        try:
            url = f"{self.api_base}/status/board"
            response = requests.get(url, headers=self._get_api_headers())
            response.raise_for_status()
            data = response.json()
            
            # Count cards by column
            by_column = {}
            total = 0
            
            if "columns" in data:
                for col_name, cards in data["columns"].items():
                    count = len(cards) if isinstance(cards, list) else 0
                    by_column[col_name] = count
                    total += count
            
            return {
                "total": total,
                "by_column": by_column,
                "raw": data
            }
        except Exception as e:
            raise RuntimeError(f"Failed to get board status: {e}")
    
    def get_cards(
        self, 
        column: Optional[str] = None,
        assignee: Optional[str] = None,
        label: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get cards from the board with optional filters."""
        status = self.get_status()
        all_cards = []
        
        # Flatten cards from all columns
        for col_name, cards_list in status["raw"].get("columns", {}).items():
            if isinstance(cards_list, list):
                for card in cards_list:
                    card["column"] = col_name
                    all_cards.append(card)
        
        # Apply filters
        if column:
            all_cards = [c for c in all_cards if c.get("column") == column]
        
        if assignee:
            all_cards = [c for c in all_cards if c.get("assignee") == assignee]
        
        if label:
            all_cards = [
                c for c in all_cards 
                if label in (c.get("labels") or [])
            ]
        
        return all_cards
    
    def get_card(self, card_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific card by ID."""
        cards = self.get_cards()
        for card in cards:
            if card.get("id") == card_id or card.get("number") == card_id:
                return card
        return None
    
    def move_card(
        self,
        card_id: str,
        target_column: str,
        sync: bool = False
    ) -> bool:
        """Move a card to a target column."""
        if target_column not in self.columns:
            raise ValueError(f"Invalid column: {target_column}. Valid: {list(self.columns.keys())}")
        
        try:
            # Update via API
            url = f"{self.api_base}/status/board/move"
            payload = {
                "cardId": card_id,
                "targetColumn": target_column
            }
            
            response = requests.put(url, json=payload, headers=self._get_api_headers())
            response.raise_for_status()
            
            # Also update GitHub Projects
            self._update_gh_project_status(card_id, target_column)
            
            if sync:
                self.sync()
            
            return True
        except Exception as e:
            print(f"Failed to move card: {e}")
            return False
    
    def update_card(
        self,
        card_id: str,
        assignee: Optional[str] = None,
        description: Optional[str] = None,
        labels: Optional[List[str]] = None,
        sync: bool = False
    ) -> bool:
        """Update card properties."""
        try:
            url = f"{self.api_base}/status/board/{card_id}"
            payload = {}
            
            if assignee is not None:
                payload["assignee"] = assignee
            if description is not None:
                payload["description"] = description
            if labels is not None:
                payload["labels"] = labels
            
            response = requests.patch(url, json=payload, headers=self._get_api_headers())
            response.raise_for_status()
            
            if sync:
                self.sync()
            
            return True
        except Exception as e:
            print(f"Failed to update card: {e}")
            return False
    
    def batch_move(self, moves: List[tuple]) -> bool:
        """Move multiple cards at once. moves: [(card_id, target_column), ...]"""
        try:
            for card_id, target_column in moves:
                self.move_card(card_id, target_column, sync=False)
            self.sync()
            return True
        except Exception as e:
            print(f"Batch move failed: {e}")
            return False
    
    def batch_update(self, updates: List[Dict[str, Any]]) -> bool:
        """Update multiple cards at once."""
        try:
            for update in updates:
                card_id = update.pop("id")
                self.update_card(card_id, sync=False, **update)
            self.sync()
            return True
        except Exception as e:
            print(f"Batch update failed: {e}")
            return False
    
    def _update_gh_project_status(self, card_id: str, column: str) -> bool:
        """Update GitHub Projects status for a card."""
        try:
            if not self.status_field_id or not self.github_token:
                return False
            
            column_id = self.columns.get(column)
            if not column_id:
                return False
            
            # GitHub GraphQL mutation would go here
            # This is a simplified version using gh CLI
            cmd = [
                "gh", "project", "item-edit",
                "--project-id", self.project_id,
                "--id", card_id,
                "--field-id", self.status_field_id,
                "--single-select-option-id", column_id
            ]
            
            subprocess.run(cmd, check=False, capture_output=True)
            return True
        except Exception as e:
            print(f"GitHub Projects update failed: {e}")
            return False
    
    def sync(self) -> bool:
        """Sync board to API and GitHub Projects."""
        try:
            # Run sync script if it exists
            sync_script = os.path.expanduser("~/.xomboard/sync.sh")
            if os.path.exists(sync_script):
                result = subprocess.run(["bash", sync_script], capture_output=True, text=True)
                return result.returncode == 0
            else:
                # Direct API call to trigger sync
                url = f"{self.api_base}/status/board/sync"
                response = requests.post(url, headers=self._get_api_headers())
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Sync failed: {e}")
            return False


def create_default_config(config_path: str = None) -> None:
    """Create a default configuration file."""
    if config_path is None:
        config_path = os.path.expanduser("~/.xomboard/config.json")
    
    default_config = {
        "api_base": "https://api.xomware.com",
        "api_auth_hash": "YOUR_AUTH_HASH_HERE",
        "github_token": "YOUR_GITHUB_TOKEN_HERE",
        "project_id": "PVT_kwDOD63LP84BPziU",
        "board_owner": "Xomware",
        "status_field_id": "PVTSSF_lADOD63LP84BPziUzg-G7i8",
        "columns": {
            "Backlog": "dfec8e4f",
            "Up Next": "841d46a7",
            "In Progress": "ce09eedb",
            "In Review": "322a35f9",
            "Done": "76b606f7"
        }
    }
    
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w") as f:
        json.dump(default_config, f, indent=2)
    
    print(f"Created default config at {config_path}")
    print("Please update with your actual API credentials.")
