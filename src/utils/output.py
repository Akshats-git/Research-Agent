from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.text import Text

console = Console()

AGENT_STYLES = {
    "orchestrator": ("bold cyan", "Orchestrator"),
    "web_researcher": ("bold green", "Web Researcher"),
    "document_analyst": ("bold yellow", "Document Analyst"),
    "synthesizer": ("bold magenta", "Synthesizer"),
}


def print_header():
    console.print()
    console.print(
        Panel(
            Text("Multi-Agent Research Assistant", style="bold white", justify="center"),
            subtitle="Powered by LangGraph + LangChain",
            border_style="bright_blue",
            padding=(1, 2),
        )
    )
    console.print()


def print_agent_status(agent_name: str, message: str):
    style, label = AGENT_STYLES.get(agent_name, ("bold white", agent_name))
    console.print(f"  [{style}][{label}][/{style}] {message}")


def print_step(step_num: int, state: dict):
    agent = state.get("current_agent", "unknown")
    style, label = AGENT_STYLES.get(agent, ("bold white", agent))
    console.print(f"\n  Step {step_num}: [{style}]{label}[/{style}] is up next")

    if "plan" in state and state["plan"]:
        console.print(f"  Plan: [dim]{state['plan'][:120]}...[/dim]" if len(state.get("plan", "")) > 120 else f"  Plan: [dim]{state.get('plan', '')}[/dim]")


def print_report(report: str):
    console.print()
    console.print(
        Panel(
            Markdown(report),
            title="[bold white]Research Report[/bold white]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()


def print_error(message: str):
    console.print(f"\n  [bold red]Error:[/bold red] {message}\n")


def print_findings_summary(web_count: int, doc_count: int):
    console.print(f"\n  [dim]Findings collected: {web_count} web, {doc_count} document[/dim]")
