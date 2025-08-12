#!/usr/bin/env python3
"""
Swarm Framework Example Usage
Demonstrates multi-agent coordination for Claude Code tasks
"""

from swarm_framework import Swarm, Agent, Message, create_claude_code_agents
import os

def example_single_agent():
    """Example: Single agent execution"""
    print("\n🤖 Example 1: Single Agent Execution")
    print("-" * 40)
    
    # Create swarm
    swarm = create_claude_code_agents()
    
    # Create a message
    message = Message(
        role="user",
        content="Analyze the following React component for potential improvements:\n\nfunction LoginForm() {\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n  \n  const handleSubmit = (e) => {\n    e.preventDefault();\n    fetch('/api/login', {\n      method: 'POST',\n      body: JSON.stringify({email, password})\n    });\n  };\n  \n  return (\n    <form onSubmit={handleSubmit}>\n      <input value={email} onChange={e => setEmail(e.target.value)} />\n      <input value={password} onChange={e => setPassword(e.target.value)} />\n      <button type=\"submit\">Login</button>\n    </form>\n  );\n}"
    )
    
    # Note: This would require actual OpenAI API key to run
    print("📝 Would analyze React component with code_analyst agent")
    print("🔑 Requires OPENAI_API_KEY environment variable to execute")

def example_agent_handoff():
    """Example: Agent handoff workflow"""
    print("\n🔄 Example 2: Agent Handoff Workflow")
    print("-" * 40)
    
    swarm = create_claude_code_agents()
    
    # Simulate handoff workflow
    workflow = [
        ("code_analyst", "Analyze authentication system security"),
        ("security_specialist", "Review security recommendations"),
        ("backend_dev", "Implement security improvements"),
        ("devops_engineer", "Deploy security updates")
    ]
    
    print("🔄 Handoff Workflow:")
    for i, (agent, task) in enumerate(workflow, 1):
        print(f"   {i}. {agent}: {task}")
    
    print("💡 This demonstrates how tasks flow between specialized agents")

def example_multi_agent_sequence():
    """Example: Multi-agent sequence execution"""  
    print("\n🏃‍♂️ Example 3: Multi-Agent Sequence")
    print("-" * 40)
    
    swarm = create_claude_code_agents()
    
    # Define agent sequence for full-stack feature development
    agent_sequence = [
        "code_analyst",      # Analyze requirements
        "frontend_dev",      # Design UI/UX  
        "backend_dev",       # Implement API
        "security_specialist", # Security review
        "devops_engineer"    # Deployment strategy
    ]
    
    initial_task = "Implement user profile management feature with avatar upload"
    
    print(f"📋 Task: {initial_task}")
    print("🔄 Agent Sequence:")
    for i, agent in enumerate(agent_sequence, 1):
        print(f"   {i}. {agent}")
    
    print("💡 Each agent builds upon the previous agent's output")

def example_context_sharing():
    """Example: Context variable sharing between agents"""
    print("\n🔗 Example 4: Context Variable Sharing")
    print("-" * 40)
    
    swarm = create_claude_code_agents()
    
    # Set shared context
    swarm.set_context("project_type", "E-commerce Platform")
    swarm.set_context("tech_stack", "React + Node.js + PostgreSQL")
    swarm.set_context("deployment", "AWS ECS + RDS")
    swarm.set_context("team_size", 5)
    swarm.set_context("timeline", "8 weeks")
    
    print("🔗 Shared Context Variables:")
    for key, value in swarm.context_variables.items():
        print(f"   {key}: {value}")
    
    print("💡 All agents can access and modify shared context")

def example_state_persistence():
    """Example: Save and load swarm state"""
    print("\n💾 Example 5: State Persistence") 
    print("-" * 40)
    
    swarm = create_claude_code_agents()
    
    # Add some conversation history
    swarm.add_message(Message(role="user", content="Analyze authentication system"))
    swarm.add_message(Message(role="assistant", content="Authentication analysis complete", name="code_analyst"))
    
    # Set context
    swarm.set_context("analysis_complete", True)
    swarm.set_context("next_step", "security_review")
    
    # Save state
    filename = "/mnt/c/Users/Admin/source/repos/XP/swarm_state.json"
    swarm.save_state(filename)
    
    print(f"💾 Saved swarm state to: {filename}")
    
    # Create new swarm and load state  
    new_swarm = Swarm()
    new_swarm.load_state(filename)
    
    print("📂 Loaded state into new swarm instance")
    print(f"✅ Agents: {new_swarm.list_agents()}")
    print(f"✅ Messages: {len(new_swarm.conversation_history)}")
    print(f"✅ Context: {new_swarm.context_variables}")

def example_agent_specialization():
    """Example: Creating custom specialized agents"""
    print("\n🎯 Example 6: Custom Agent Specialization")
    print("-" * 40)
    
    swarm = Swarm()
    
    # Database Specialist Agent
    db_agent = Agent(
        name="database_specialist",
        instructions="""You are a database expert specializing in PostgreSQL optimization and design.
        Focus on: query optimization, indexing, schema design, performance tuning, and data integrity.
        Always provide specific SQL examples and performance metrics.""",
        model="gpt-4",
        temperature=0.3  # Lower temperature for more precise technical responses
    )
    
    # Testing Specialist Agent
    test_agent = Agent(
        name="test_engineer", 
        instructions="""You are a testing specialist focusing on automated testing and quality assurance.
        Focus on: unit tests, integration tests, E2E tests, test automation, and quality metrics.
        Always provide specific test cases and testing strategies.""",
        model="gpt-4",
        temperature=0.5
    )
    
    # Performance Specialist Agent
    perf_agent = Agent(
        name="performance_engineer",
        instructions="""You are a performance engineer specializing in application optimization.
        Focus on: performance profiling, bottleneck identification, caching strategies, and scalability.
        Always provide metrics, benchmarks, and optimization recommendations.""",
        model="gpt-4", 
        temperature=0.4
    )
    
    # Add specialized agents
    for agent in [db_agent, test_agent, perf_agent]:
        swarm.add_agent(agent)
    
    print("🎯 Created specialized agents:")
    for agent_name in swarm.list_agents():
        agent = swarm.get_agent(agent_name)
        print(f"   - {agent_name} (temp: {agent.temperature})")
    
    print("💡 Different agents can have different models and parameters")

if __name__ == "__main__":
    print("🐝 Swarm Framework Examples for Claude Code")
    print("=" * 50)
    
    # Check if OpenAI API key is available
    has_api_key = bool(os.getenv('OPENAI_API_KEY'))
    if not has_api_key:
        print("⚠️ OPENAI_API_KEY not set - examples will show structure only")
    
    # Run all examples
    example_single_agent()
    example_agent_handoff()
    example_multi_agent_sequence()
    example_context_sharing()
    example_state_persistence()
    example_agent_specialization()
    
    print("\n🎉 Examples completed!")
    print("🔑 Set OPENAI_API_KEY environment variable to run actual agent execution")
    print("📚 Check swarm_framework.py for full implementation details")