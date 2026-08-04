#!/usr/bin/env python3
"""
GitHub Batch Issues
Create multiple related GitHub issues from templates with XomBoard integration.
"""

import yaml
import json
import argparse
import sys
from typing import List, Dict, Any, Optional
from pathlib import Path
import subprocess
import os

try:
    import requests
except ImportError:
    print("requests library required. Install: pip install requests")
    sys.exit(1)


class BatchIssueCreator:
    """Create batches of GitHub issues from templates."""
    
    def __init__(self, token: str, owner: str):
        """Initialize with GitHub token and owner."""
        self.token = token
        self.owner = owner
        self.base_url = "https://api.github.com"
        self.created_issues = {}  # Track created issues
        
    def _get_headers(self) -> Dict[str, str]:
        """Get GitHub API headers."""
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    
    def load_template(self, template_path: str) -> Dict[str, Any]:
        """Load template from YAML file."""
        with open(template_path, "r") as f:
            return yaml.safe_load(f)
    
    def validate_template(self, template: Dict[str, Any]) -> tuple[bool, List[str]]:
        """Validate template structure."""
        errors = []
        
        if "template_id" not in template:
            errors.append("Missing 'template_id'")
        
        if "issues" not in template:
            errors.append("Missing 'issues' list")
        elif not isinstance(template["issues"], list):
            errors.append("'issues' must be a list")
        
        for i, issue in enumerate(template.get("issues", [])):
            if "title" not in issue:
                errors.append(f"Issue {i}: missing 'title'")
        
        return len(errors) == 0, errors
    
    def create_issue(
        self,
        repo: str,
        title: str,
        description: Optional[str] = None,
        assignee: Optional[str] = None,
        labels: Optional[List[str]] = None,
        milestone: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a single GitHub issue."""
        try:
            url = f"{self.base_url}/repos/{self.owner}/{repo}/issues"
            
            payload = {
                "title": title,
            }
            
            if description:
                payload["body"] = description
            
            if assignee:
                payload["assignees"] = [assignee]
            
            if labels:
                payload["labels"] = labels
            
            # Milestone requires project owner
            # if milestone:
            #     payload["milestone"] = milestone
            
            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers()
            )
            response.raise_for_status()
            
            data = response.json()
            return {
                "success": True,
                "issue_number": data["number"],
                "issue_id": data["id"],
                "url": data["html_url"],
                "title": title
            }
        except Exception as e:
            return {
                "success": False,
                "title": title,
                "error": str(e)
            }
    
    def add_to_xomboard(self, issue_url: str) -> bool:
        """Add issue to XomBoard via API."""
        try:
            # Use the xomboard-cli if available
            result = subprocess.run(
                ["xomboard", "list"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False
    
    def link_issues(
        self,
        repo: str,
        parent_id: int,
        children_ids: List[int]
    ) -> bool:
        """Link parent-child issues via GitHub API."""
        try:
            # GitHub doesn't have native parent-child links
            # Use comments to establish relationships
            comment = "**Related issues (children):**\n"
            for child_id in children_ids:
                comment += f"- #{child_id}\n"
            
            url = f"{self.base_url}/repos/{self.owner}/{repo}/issues/{parent_id}/comments"
            
            payload = {"body": comment}
            
            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers()
            )
            response.raise_for_status()
            
            return True
        except Exception as e:
            print(f"Failed to link issues: {e}")
            return False
    
    def create_from_template(
        self,
        template_file: str,
        repo: Optional[str] = None,
        assignee_override: Optional[str] = None,
        label_override: Optional[List[str]] = None,
        milestone: Optional[str] = None,
        add_to_board: bool = False,
        dry_run: bool = False
    ) -> List[Dict[str, Any]]:
        """Create multiple issues from a template."""
        
        # Load template
        template = self.load_template(template_file)
        
        # Validate
        valid, errors = self.validate_template(template)
        if not valid:
            print("Template validation failed:")
            for error in errors:
                print(f"  - {error}")
            return []
        
        # Use repo from template or override
        if repo is None:
            repo = template.get("repo")
        
        if not repo:
            print("No repo specified in template or arguments")
            return []
        
        # Create issues
        results = []
        issue_map = {}  # Track created issues for linking
        
        print(f"Creating {len(template['issues'])} issue(s) in {repo}...")
        
        for i, issue_template in enumerate(template["issues"]):
            title = issue_template["title"]
            description = issue_template.get("description", "")
            assignee = assignee_override or issue_template.get("assignee")
            
            # Merge labels
            labels = label_override or issue_template.get("labels", [])
            if "default_labels" in template and not label_override:
                labels = list(set(labels + template["default_labels"]))
            
            print(f"  [{i+1}/{len(template['issues'])}] {title}...", end=" ", flush=True)
            
            if dry_run:
                print("(dry run)")
                results.append({
                    "success": True,
                    "issue_number": None,
                    "title": title,
                    "dry_run": True
                })
            else:
                result = self.create_issue(
                    repo=repo,
                    title=title,
                    description=description,
                    assignee=assignee,
                    labels=labels,
                    milestone=milestone
                )
                
                if result["success"]:
                    print(f"#{result['issue_number']}")
                    issue_map[i] = result["issue_number"]
                    
                    # Add to XomBoard
                    if add_to_board and "url" in result:
                        self.add_to_xomboard(result["url"])
                else:
                    print(f"FAILED: {result['error']}")
                
                results.append(result)
        
        # Handle relationships
        if not dry_run:
            for i, issue_template in enumerate(template["issues"]):
                if "depends_on" in issue_template:
                    # Create comment linking dependency
                    parent_issue_num = issue_template["depends_on"]
                    if isinstance(parent_issue_num, int) and parent_issue_num in issue_map:
                        parent_num = issue_map[parent_issue_num]
                        child_num = issue_map.get(i)
                        if child_num:
                            self.link_issues(repo, parent_num, [child_num])
        
        return results


def cmd_create(args):
    """Create issues from template."""
    try:
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            print("Error: GITHUB_TOKEN environment variable not set")
            return 1
        
        creator = BatchIssueCreator(token=token, owner=args.owner)
        
        results = creator.create_from_template(
            template_file=args.template,
            repo=args.repo,
            assignee_override=args.assignee,
            label_override=args.labels.split(",") if args.labels else None,
            milestone=args.milestone,
            add_to_board=args.add_to_board,
            dry_run=args.dry_run
        )
        
        # Summary
        successful = [r for r in results if r.get("success")]
        failed = [r for r in results if not r.get("success")]
        
        print(f"\n✓ Created: {len(successful)}/{len(results)}")
        
        if failed:
            print(f"\n✗ Failed: {len(failed)}")
            for r in failed:
                print(f"  - {r['title']}: {r.get('error', 'Unknown error')}")
        
        return 0 if len(failed) == 0 else 1
    
    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_validate(args):
    """Validate a template."""
    try:
        token = os.getenv("GITHUB_TOKEN")
        creator = BatchIssueCreator(token=token or "", owner=args.owner)
        
        template = creator.load_template(args.template)
        valid, errors = creator.validate_template(template)
        
        if valid:
            print("✓ Template valid")
            print(f"- {len(template['issues'])} issues")
            
            assignees = set()
            labels = set()
            for issue in template['issues']:
                if issue.get('assignee'):
                    assignees.add(issue['assignee'])
                for label in issue.get('labels', []):
                    labels.add(label)
            
            if assignees:
                print(f"- Assignees: {', '.join(sorted(assignees))}")
            if labels:
                print(f"- Labels: {', '.join(sorted(labels))}")
            
            return 0
        else:
            print("✗ Template invalid:")
            for error in errors:
                print(f"  - {error}")
            return 1
    
    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_link(args):
    """Link issues together."""
    try:
        token = os.getenv("GITHUB_TOKEN")
        creator = BatchIssueCreator(token=token, owner=args.owner)
        
        children = [int(x.strip()) for x in args.children.split(",")]
        
        if creator.link_issues(args.repo, args.parent, children):
            print(f"✓ Linked {args.parent} -> {', '.join(map(str, children))}")
            return 0
        else:
            print("✗ Failed to link issues")
            return 1
    
    except Exception as e:
        print(f"Error: {e}")
        return 1


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        prog="github-batch-issues",
        description="Create batches of GitHub issues from templates"
    )
    
    parser.add_argument("--owner", default="Xomware", help="GitHub owner/org")
    
    subparsers = parser.add_subparsers(dest="command", help="Command")
    subparsers.required = True
    
    # Create command
    create_parser = subparsers.add_parser("create", help="Create issues from template")
    create_parser.add_argument("--template", required=True, help="Template YAML file")
    create_parser.add_argument("--repo", help="Repository (override template)")
    create_parser.add_argument("--assignee", help="Override assignee")
    create_parser.add_argument("--labels", help="Override labels (comma-separated)")
    create_parser.add_argument("--milestone", help="Milestone")
    create_parser.add_argument("--add-to-board", action="store_true", help="Add to XomBoard")
    create_parser.add_argument("--dry-run", action="store_true", help="Preview without creating")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate template")
    validate_parser.add_argument("--template", required=True, help="Template YAML file")
    
    # Link command
    link_parser = subparsers.add_parser("link", help="Link issues")
    link_parser.add_argument("--parent", type=int, required=True, help="Parent issue number")
    link_parser.add_argument("--children", required=True, help="Child issue numbers (comma-separated)")
    link_parser.add_argument("--repo", required=True, help="Repository")
    
    args = parser.parse_args()
    
    if args.command == "create":
        return cmd_create(args)
    elif args.command == "validate":
        return cmd_validate(args)
    elif args.command == "link":
        return cmd_link(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
