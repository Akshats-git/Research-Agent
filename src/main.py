"""Command-line entry point for running the research graph without the web UI."""

import argparse
import sys

from rich.console import Console
from rich.status import Status

from src.graph import build_graph
from src.utils.output import (
    print_header,
    print_agent_status,
    print_report,
    print_error,
)

console = Console()


def _initial_state(query: str, documents: list[str] | None) -> dict:
    return {
        "query": query,
        "plan": "",
        "reasoning": "",
        "web_findings": [],
        "doc_findings": [],
        "documents": documents or [],
        "final_report": "",
        "current_agent": "",
        "messages": [],
        "iteration": 0,
    }


def _narrate_step(node_name: str, node_state: dict) -> None:
    """Print a one-line status for whichever node just finished."""
    if node_name == "orchestrator":
        next_agent = node_state.get("current_agent", "")
        print_agent_status("orchestrator", f"Routing to [bold]{next_agent}[/bold]")
        plan = node_state.get("plan", "")
        if plan:
            preview = plan if len(plan) <= 150 else plan[:150] + "..."
            console.print(f"    [dim]{preview}[/dim]")
    elif node_name == "web_researcher":
        count = len(node_state.get("web_findings", []))
        print_agent_status("web_researcher", f"Found {count} finding(s)")
    elif node_name == "document_analyst":
        count = len(node_state.get("doc_findings", []))
        print_agent_status("document_analyst", f"Analyzed, {count} finding(s)")
    elif node_name == "synthesizer":
        print_agent_status("synthesizer", "Generating final report...")


def run_research(query: str, documents: list[str] | None = None) -> None:
    print_header()
    console.print(f"  [bold]Query:[/bold] {query}")
    if documents:
        console.print(f"  [bold]Documents:[/bold] {', '.join(documents)}")
    console.print()

    graph = build_graph()
    final_state = None
    step_count = 0

    try:
        with Status("[bold blue]Researching...[/bold blue]", console=console, spinner="dots") as status:
            for step in graph.stream(_initial_state(query, documents)):
                step_count += 1
                for node_name, node_state in step.items():
                    status.update(f"[bold blue]Step {step_count}: {node_name} working...[/bold blue]")
                    _narrate_step(node_name, node_state)
                    final_state = node_state
    except KeyboardInterrupt:
        console.print("\n\n  [yellow]Research interrupted by user.[/yellow]\n")
        sys.exit(0)
    except Exception as e:
        print_error(str(e))
        sys.exit(1)

    if final_state and final_state.get("final_report"):
        print_report(final_state["final_report"])
    else:
        print_error("No report was generated. The research may have ended prematurely.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Multi-Agent Research Assistant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               '  python -m src.main "What are the latest advances in quantum computing?"\n'
               '  python -m src.main "Summarize key themes" --files paper.pdf notes.txt',
    )
    parser.add_argument("query", nargs="?", help="Research query")
    parser.add_argument("--files", nargs="+", help="Document file paths for analysis", default=[])
    args = parser.parse_args()

    if args.query:
        run_research(args.query, args.files)
        return

    # No query given: drop into an interactive prompt loop.
    print_header()
    console.print("  Enter your research query (or [bold]Ctrl+C[/bold] to exit):\n")
    try:
        while True:
            query = console.input("  [bold bright_blue]>[/bold bright_blue] ").strip()
            if query:
                run_research(query)
                console.print("\n  Enter another query (or [bold]Ctrl+C[/bold] to exit):\n")
    except (KeyboardInterrupt, EOFError):
        console.print("\n\n  [dim]Goodbye![/dim]\n")


if __name__ == "__main__":
    main()
