# 🐝 Swarm Framework Setup Guide for Claude Code

## 📖 Tổng quan

Swarm Framework là hệ thống multi-agent orchestration giúp điều phối nhiều AI agent chuyên biệt làm việc cùng nhau. Framework này được thiết kế đặc biệt cho Claude Code để hỗ trợ:

- **Multi-agent coordination** - Điều phối nhiều agent cùng lúc
- **Task delegation** - Phân công công việc giữa các agent
- **Context sharing** - Chia sẻ thông tin giữa các agent  
- **Workflow orchestration** - Quản lý quy trình làm việc phức tạp

## 🚀 Cài đặt nhanh

### Bước 1: Thiết lập môi trường Python

```bash
# Tạo virtual environment
python3 -m venv swarm_env

# Kích hoạt môi trường
source swarm_env/bin/activate  # Linux/Mac
# hoặc
swarm_env\Scripts\activate  # Windows
```

### Bước 2: Cài đặt dependencies

```bash
# Cài đặt OpenAI SDK
pip install openai

# Cài đặt thêm các package hỗ trợ (tùy chọn)
pip install numpy requests aiohttp
```

### Bước 3: Thiết lập API Key

```bash
# Thiết lập OpenAI API Key
export OPENAI_API_KEY='your-openai-api-key-here'

# Hoặc tạo file .env
echo "OPENAI_API_KEY=your-openai-api-key-here" > .env
```

### Bước 4: Sử dụng framework

```python
from swarm_framework import create_claude_code_agents, Message

# Tạo swarm với các agent pre-configured
swarm = create_claude_code_agents()

# Sử dụng single agent
message = Message(role="user", content="Analyze this code...")
result = swarm.run("code_analyst", [message])

# Multi-agent workflow
agents = ["code_analyst", "security_specialist", "backend_dev"]
results = swarm.multi_agent_run(agents, "Implement authentication system")
```

## 🤖 Các Agent có sẵn

Framework cung cấp 5 agent chuyên biệt:

| Agent | Chuyên môn | Ứng dụng |
|-------|------------|----------|
| `code_analyst` | Phân tích code, architecture | Code review, system analysis |
| `frontend_dev` | React, TypeScript, UI/UX | Frontend development, responsive design |
| `backend_dev` | Node.js, APIs, databases | Server-side development, API design |
| `devops_engineer` | Deployment, monitoring | Infrastructure, CI/CD, monitoring |
| `security_specialist` | Security, compliance | Security audit, vulnerability assessment |

## 🔄 Các loại Workflow

### 1. Single Agent Execution

```python
# Chạy một agent duy nhất
result = swarm.run("code_analyst", [message])
print(result.messages[-1].content)
```

### 2. Agent Handoff

```python
# Chuyển giao công việc giữa các agent
result = swarm.handoff(
    from_agent="code_analyst",
    to_agent="security_specialist", 
    message="Please review security implications",
    context={"analysis_complete": True}
)
```

### 3. Multi-Agent Sequence

```python
# Chuỗi agents xử lý tuần tự
agent_sequence = [
    "code_analyst",      # Phân tích yêu cầu
    "frontend_dev",      # Thiết kế UI
    "backend_dev",       # Implement API
    "security_specialist", # Security review
    "devops_engineer"    # Deployment plan
]

results = swarm.multi_agent_run(
    agent_sequence, 
    "Implement user profile management"
)
```

### 4. Context Sharing

```python
# Chia sẻ context giữa các agent
swarm.set_context("project_type", "E-commerce")
swarm.set_context("tech_stack", "React + Node.js")
swarm.set_context("deadline", "2 weeks")

# Tất cả agents có thể truy cập context này
context = swarm.get_context("tech_stack")
```

### 5. State Persistence

```python
# Lưu state để tiếp tục sau
swarm.save_state("project_workflow.json")

# Load state trong session khác
new_swarm = Swarm()
new_swarm.load_state("project_workflow.json")
```

## 🎯 Ví dụ thực tế

### Feature Development Workflow

```python
from swarm_framework import create_claude_code_agents, Message

# Khởi tạo swarm
swarm = create_claude_code_agents()

# Set project context
swarm.set_context("feature", "User Authentication")
swarm.set_context("framework", "React + Express")
swarm.set_context("database", "PostgreSQL")

# Define workflow
workflow_steps = [
    ("code_analyst", "Analyze authentication requirements and existing system"),
    ("security_specialist", "Define security requirements and best practices"),
    ("backend_dev", "Design API endpoints and database schema"),
    ("frontend_dev", "Design login/register UI components"),
    ("devops_engineer", "Plan deployment and monitoring strategy")
]

# Execute workflow
initial_message = "Implement secure user authentication with JWT tokens"
current_message = initial_message

for agent_name, task_description in workflow_steps:
    print(f"\n🏃‍♂️ Running {agent_name}: {task_description}")
    
    # Create message with task context
    message = Message(
        role="user", 
        content=f"{current_message}\n\nFocus on: {task_description}"
    )
    
    # Run agent
    result = swarm.run(agent_name, [message])
    
    # Use output for next agent
    if result.messages:
        current_message = result.messages[-1].content
        
    # Show progress
    print(f"✅ {agent_name} completed")

# Save final state
swarm.save_state("auth_implementation_state.json")
print("\n💾 Workflow state saved!")
```

### Bug Investigation Workflow

```python
# Bug analysis workflow
bug_workflow = [
    ("code_analyst", "Analyze error logs and identify potential causes"),
    ("security_specialist", "Check for security-related issues"),
    ("backend_dev", "Investigate database and API issues"),
    ("frontend_dev", "Check UI/UX and client-side issues"),
    ("devops_engineer", "Review infrastructure and deployment issues")
]

bug_report = """
Error: "Database connection timeout" occurring intermittently
- Affects 5% of users
- Peak hours (9-11 AM, 2-4 PM)
- Both login and profile update operations
- Error logs show connection pool exhaustion
"""

# Run investigation
results = swarm.multi_agent_run(
    [step[0] for step in bug_workflow],
    bug_report
)

# Compile recommendations
print("🔍 Investigation Results:")
for i, result in enumerate(results):
    agent_name = bug_workflow[i][0]
    print(f"\n{agent_name}:")
    print(result.messages[-1].content[:200] + "...")
```

## 🛠️ Tùy chỉnh Agents

### Tạo Agent chuyên biệt

```python
from swarm_framework import Agent, Swarm

# Tạo Database Specialist Agent
db_specialist = Agent(
    name="database_specialist",
    instructions="""You are a PostgreSQL expert specializing in:
    - Query optimization and indexing
    - Database schema design
    - Performance tuning and monitoring
    - Data migration and backup strategies
    
    Always provide specific SQL examples and performance metrics.""",
    model="gpt-4",
    temperature=0.3,  # Chính xác hơn cho technical tasks
    max_tokens=1500
)

# Tạo Testing Specialist Agent  
test_specialist = Agent(
    name="test_engineer",
    instructions="""You are a testing expert focusing on:
    - Unit testing with Jest/Mocha
    - Integration testing strategies
    - E2E testing with Playwright/Cypress
    - Test automation and CI/CD integration
    
    Always provide specific test cases and coverage metrics.""",
    model="gpt-4",
    temperature=0.4
)

# Thêm vào swarm
swarm = Swarm()
swarm.add_agent(db_specialist)
swarm.add_agent(test_specialist)
```

### Tùy chỉnh Agent behavior

```python
# Agent với custom functions
def analyze_performance_metrics(data):
    """Custom function for performance analysis"""
    # Implementation here
    return {"metrics": data, "recommendations": []}

performance_agent = Agent(
    name="performance_specialist",
    instructions="Analyze application performance and provide optimization recommendations",
    functions=[analyze_performance_metrics],
    temperature=0.2,  # Very precise for metrics
    max_tokens=2000
)
```

## 📊 Monitoring và Statistics

```python
# Lấy thống kê swarm
stats = swarm.get_stats()
print(f"Total agents: {stats['total_agents']}")
print(f"Conversation length: {stats['conversation_length']}")
print(f"Active context variables: {stats['context_variables']}")

# Lịch sử conversation
for msg in swarm.conversation_history[-5:]:  # 5 messages gần nhất
    print(f"{msg.role} ({msg.name}): {msg.content[:100]}...")

# Context variables
for key, value in swarm.context_variables.items():
    print(f"{key}: {value}")
```

## 🔧 Troubleshooting

### Lỗi thường gặp

**1. "OpenAI API key required"**
```bash
# Đảm bảo API key được set
export OPENAI_API_KEY='your-key-here'
# hoặc
echo $OPENAI_API_KEY  # Kiểm tra key có được set chưa
```

**2. "Agent not found"**
```python
# Kiểm tra agents có sẵn
print(swarm.list_agents())

# Add agent nếu chưa có
swarm.add_agent(your_agent)
```

**3. Rate limiting errors**
```python
# Giảm temperature và max_tokens
agent.temperature = 0.3
agent.max_tokens = 1000

# Thêm delay giữa các calls (nếu cần)
import time
time.sleep(1)
```

### Debug mode

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Xem detailed conversation
for msg in swarm.conversation_history:
    print(f"[{msg.timestamp}] {msg.role}: {msg.content}")
```

## 🎯 Best Practices

### 1. Agent Selection
- Chọn đúng agent cho từng task type
- Sử dụng temperature thấp (0.2-0.4) cho technical tasks
- Sử dụng temperature cao (0.7-0.9) cho creative tasks

### 2. Context Management
- Set meaningful context variables
- Clear context khi không cần thiết
- Use context để maintain state across agents

### 3. Error Handling
- Always check result.messages before processing
- Implement retry logic cho API failures
- Save state thường xuyên cho long-running workflows

### 4. Performance Optimization
- Limit conversation history length
- Use specific, focused instructions
- Batch similar tasks when possible

## 📚 Resources

- **Framework Files:**
  - `swarm_framework.py` - Core implementation
  - `swarm_example.py` - Usage examples
  - `swarm_demo.py` - Demo without API key
  
- **Documentation:**
  - [OpenAI API Documentation](https://platform.openai.com/docs)
  - [Claude Code Documentation](https://docs.anthropic.com/claude-code)

## 🎉 Kết luận

Swarm Framework cung cấp khả năng orchestration mạnh mẽ cho Claude Code, cho phép:

- **Specialized expertise** từ nhiều agents chuyên biệt
- **Complex workflow** management và coordination  
- **Context preservation** across multi-step tasks
- **Scalable architecture** cho large projects

Với framework này, bạn có thể xây dựng các workflow phức tạp kết hợp multiple domain experts để giải quyết các vấn đề technical challenging một cách hiệu quả.

**Bắt đầu ngay:** Chạy `python swarm_demo.py` để xem demo hoặc `python swarm_example.py` với OPENAI_API_KEY để test thực tế!