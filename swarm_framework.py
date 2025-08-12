#!/usr/bin/env python3
"""
Swarm Framework Implementation for Claude Code
Multi-agent orchestration system inspired by OpenAI Swarm
"""

import json
import asyncio
from typing import List, Dict, Any, Optional, Callable, Union
from dataclasses import dataclass, asdict
from datetime import datetime
import openai
import os

@dataclass
class Agent:
    """Represents a single agent in the swarm"""
    name: str
    instructions: str
    functions: List[Callable] = None
    model: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 1000
    
    def __post_init__(self):
        if self.functions is None:
            self.functions = []

@dataclass 
class Message:
    """Represents a message in the conversation"""
    role: str  # 'system', 'user', 'assistant', 'function'
    content: str
    name: Optional[str] = None
    function_call: Optional[Dict] = None
    timestamp: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()

@dataclass
class SwarmResult:
    """Result of a swarm execution"""
    messages: List[Message]
    agent: Agent
    context_variables: Dict[str, Any]
    
class Swarm:
    """Main Swarm orchestration class"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Swarm with OpenAI client"""
        if api_key:
            self.client = openai.OpenAI(api_key=api_key)
        else:
            # Try to get from environment
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OpenAI API key required. Set OPENAI_API_KEY environment variable or pass api_key parameter.")
            self.client = openai.OpenAI(api_key=api_key)
        
        self.agents: Dict[str, Agent] = {}
        self.conversation_history: List[Message] = []
        self.context_variables: Dict[str, Any] = {}
        
    def add_agent(self, agent: Agent) -> None:
        """Add an agent to the swarm"""
        self.agents[agent.name] = agent
        print(f"✅ Added agent: {agent.name}")
        
    def remove_agent(self, agent_name: str) -> bool:
        """Remove an agent from the swarm"""
        if agent_name in self.agents:
            del self.agents[agent_name]
            print(f"🗑️ Removed agent: {agent_name}")
            return True
        return False
        
    def get_agent(self, agent_name: str) -> Optional[Agent]:
        """Get an agent by name"""
        return self.agents.get(agent_name)
        
    def list_agents(self) -> List[str]:
        """List all agent names"""
        return list(self.agents.keys())
        
    def set_context(self, key: str, value: Any) -> None:
        """Set a context variable"""
        self.context_variables[key] = value
        
    def get_context(self, key: str, default: Any = None) -> Any:
        """Get a context variable"""
        return self.context_variables.get(key, default)
        
    def clear_history(self) -> None:
        """Clear conversation history"""
        self.conversation_history.clear()
        print("🧹 Cleared conversation history")
        
    def add_message(self, message: Message) -> None:
        """Add a message to conversation history"""
        self.conversation_history.append(message)
        
    def run(self, agent_name: str, messages: List[Message], 
            context_variables: Optional[Dict[str, Any]] = None,
            max_turns: int = 10) -> SwarmResult:
        """
        Run a conversation with a specific agent
        
        Args:
            agent_name: Name of the agent to use
            messages: List of messages to process
            context_variables: Optional context variables
            max_turns: Maximum number of conversation turns
            
        Returns:
            SwarmResult with final state
        """
        
        if agent_name not in self.agents:
            raise ValueError(f"Agent '{agent_name}' not found")
            
        agent = self.agents[agent_name]
        
        # Update context variables if provided
        if context_variables:
            self.context_variables.update(context_variables)
            
        # Add messages to history
        for msg in messages:
            self.add_message(msg)
            
        # Prepare messages for OpenAI API
        api_messages = []
        
        # Add system message with agent instructions
        api_messages.append({
            "role": "system",
            "content": agent.instructions
        })
        
        # Add conversation history
        for msg in self.conversation_history[-max_turns:]:  # Limit history
            api_messages.append({
                "role": msg.role,
                "content": msg.content
            })
            
        try:
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=agent.model,
                messages=api_messages,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens
            )
            
            # Process response
            assistant_message = response.choices[0].message
            
            # Create response message
            response_msg = Message(
                role="assistant",
                content=assistant_message.content,
                name=agent.name
            )
            
            # Add to history
            self.add_message(response_msg)
            
            return SwarmResult(
                messages=[response_msg],
                agent=agent,
                context_variables=self.context_variables.copy()
            )
            
        except Exception as e:
            print(f"❌ Error running agent {agent_name}: {str(e)}")
            error_msg = Message(
                role="assistant", 
                content=f"Error: {str(e)}",
                name=agent.name
            )
            return SwarmResult(
                messages=[error_msg],
                agent=agent,
                context_variables=self.context_variables.copy()
            )
    
    def handoff(self, from_agent: str, to_agent: str, 
               message: str, context: Optional[Dict[str, Any]] = None) -> SwarmResult:
        """
        Hand off conversation from one agent to another
        
        Args:
            from_agent: Name of current agent
            to_agent: Name of target agent  
            message: Message to pass to new agent
            context: Optional context to update
            
        Returns:
            SwarmResult from target agent
        """
        
        if from_agent not in self.agents:
            raise ValueError(f"Source agent '{from_agent}' not found")
        if to_agent not in self.agents:
            raise ValueError(f"Target agent '{to_agent}' not found")
            
        print(f"🔄 Handoff: {from_agent} → {to_agent}")
        
        # Add handoff message
        handoff_msg = Message(
            role="user",
            content=f"[Handoff from {from_agent}]: {message}"
        )
        
        # Run with target agent
        return self.run(
            agent_name=to_agent,
            messages=[handoff_msg],
            context_variables=context
        )
        
    def multi_agent_run(self, agent_sequence: List[str], 
                       initial_message: str,
                       context_variables: Optional[Dict[str, Any]] = None) -> List[SwarmResult]:
        """
        Run multiple agents in sequence
        
        Args:
            agent_sequence: List of agent names to run in order
            initial_message: Initial message to start with
            context_variables: Optional context variables
            
        Returns:
            List of SwarmResults from each agent
        """
        
        results = []
        current_message = initial_message
        
        if context_variables:
            self.context_variables.update(context_variables)
            
        for i, agent_name in enumerate(agent_sequence):
            print(f"🏃‍♂️ Running agent {i+1}/{len(agent_sequence)}: {agent_name}")
            
            # Create message
            msg = Message(role="user", content=current_message)
            
            # Run agent
            result = self.run(agent_name, [msg])
            results.append(result)
            
            # Use agent's response as input for next agent
            if result.messages:
                current_message = result.messages[-1].content
                
        return results
        
    def save_state(self, filename: str) -> None:
        """Save swarm state to file"""
        state = {
            "agents": {name: asdict(agent) for name, agent in self.agents.items()},
            "conversation_history": [asdict(msg) for msg in self.conversation_history],
            "context_variables": self.context_variables,
            "timestamp": datetime.now().isoformat()
        }
        
        with open(filename, 'w') as f:
            json.dump(state, f, indent=2)
        print(f"💾 Saved state to {filename}")
        
    def load_state(self, filename: str) -> None:
        """Load swarm state from file"""
        with open(filename, 'r') as f:
            state = json.load(f)
            
        # Restore agents
        self.agents = {}
        for name, agent_data in state["agents"].items():
            agent = Agent(**agent_data)
            self.agents[name] = agent
            
        # Restore conversation history  
        self.conversation_history = []
        for msg_data in state["conversation_history"]:
            msg = Message(**msg_data)
            self.conversation_history.append(msg)
            
        # Restore context
        self.context_variables = state["context_variables"]
        
        print(f"📂 Loaded state from {filename}")
        
    def get_stats(self) -> Dict[str, Any]:
        """Get swarm statistics"""
        return {
            "total_agents": len(self.agents),
            "agent_names": list(self.agents.keys()),
            "conversation_length": len(self.conversation_history),
            "context_variables": len(self.context_variables),
            "last_activity": self.conversation_history[-1].timestamp if self.conversation_history else None
        }

def create_claude_code_agents() -> Swarm:
    """Create a pre-configured swarm for Claude Code tasks"""
    
    swarm = Swarm()
    
    # Code Analyst Agent
    analyst = Agent(
        name="code_analyst", 
        instructions="""You are a senior code analyst specializing in system architecture and code review.
        Your role is to analyze code quality, identify patterns, suggest improvements, and explain complex systems.
        Focus on: code quality, performance, security, maintainability, and best practices.
        Always provide specific, actionable recommendations."""
    )
    
    # Frontend Developer Agent  
    frontend = Agent(
        name="frontend_dev",
        instructions="""You are a frontend development expert specializing in React, TypeScript, and modern web technologies.
        Your role is to solve UI/UX issues, implement components, fix styling problems, and optimize user experiences.
        Focus on: responsive design, accessibility, performance, user experience, and modern frontend practices.
        Always consider cross-browser compatibility and mobile-first design."""
    )
    
    # Backend Developer Agent
    backend = Agent(
        name="backend_dev", 
        instructions="""You are a backend development expert specializing in Node.js, databases, and API development.
        Your role is to solve server-side issues, design APIs, optimize database queries, and ensure system reliability.
        Focus on: scalability, security, performance, data integrity, and robust error handling.
        Always consider production deployment and monitoring requirements."""
    )
    
    # DevOps Agent
    devops = Agent(
        name="devops_engineer",
        instructions="""You are a DevOps engineer specializing in deployment, monitoring, and system automation.
        Your role is to solve infrastructure issues, set up CI/CD, configure monitoring, and ensure system reliability.
        Focus on: automation, monitoring, security, scalability, and operational excellence.
        Always consider production readiness and disaster recovery."""
    )
    
    # Security Specialist Agent
    security = Agent(
        name="security_specialist",
        instructions="""You are a cybersecurity specialist focusing on application security and secure development practices.
        Your role is to identify security vulnerabilities, implement security controls, and ensure compliance.
        Focus on: authentication, authorization, data protection, secure coding, and threat mitigation.
        Always prioritize security without compromising functionality."""
    )
    
    # Add all agents to swarm
    for agent in [analyst, frontend, backend, devops, security]:
        swarm.add_agent(agent)
        
    return swarm

if __name__ == "__main__":
    # Example usage
    print("🐝 Swarm Framework for Claude Code")
    print("=" * 50)
    
    try:
        # Create swarm with Claude Code agents
        swarm = create_claude_code_agents()
        
        print(f"✅ Created swarm with {len(swarm.list_agents())} agents:")
        for agent_name in swarm.list_agents():
            print(f"   - {agent_name}")
            
        # Example: Get swarm statistics
        stats = swarm.get_stats()
        print(f"\n📊 Swarm Statistics: {stats}")
        
        print(f"\n🎯 Swarm ready for multi-agent orchestration!")
        print("Use the swarm object to run agents, hand off tasks, and coordinate workflows.")
        
    except Exception as e:
        print(f"❌ Error initializing swarm: {e}")
        print("💡 Make sure to set OPENAI_API_KEY environment variable")