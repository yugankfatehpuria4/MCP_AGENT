import dotenv from "dotenv";
import path from "path";
import { createAgent, createNetwork, createTool, openai } from "@inngest/agent-kit";
import { createServer } from "@inngest/agent-kit/server";
import { z } from "zod";

dotenv.config({ path: path.join(__dirname, ".env") });

const smitheryApiKey =
  process.env.SMITHERY_API_KEY ?? process.env.SMITHERY_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const smitheryServerBaseUrl =
  process.env.SMITHERY_SERVER_URL ?? "https://server.smithery.ai/neon/mcp";
const MAX_ROUTER_ATTEMPTS = Number(process.env.MAX_ROUTER_ATTEMPTS ?? 3);

if (!openaiApiKey) {
  console.error(
    "Missing OPENAI_API_KEY. Add it to src/.env — the agent uses OpenAI (gpt-4o-mini) for inference."
  );
  process.exit(1);
}

if (!smitheryApiKey) {
  console.error(
    "Missing SMITHERY_API_KEY. Add it to src/.env for the Neon MCP server."
  );
  process.exit(1);
}

const neonServerUrl = `${smitheryServerBaseUrl}?api_key=${encodeURIComponent(smitheryApiKey)}`;
console.log(`Neon MCP server configured: ${smitheryServerBaseUrl}`);
const PORT = process.env.PORT || 3010;

const doneTool = createTool({
  name: "done",
  description: "Call this tool when content creation is finished.",
  parameters: z.object({
    title: z.string().describe("The title of the content that was created."),
    word_count: z.number().describe("The word count of the content that was created."),
    summary: z.string().describe("A brief summary of the content that was created."),
  }),
  handler: async ({ title, word_count, summary },{network}) => {
    console.log("Done tool called");
    network?.state.kv.set("completed", true);
    network?.state.kv.set("title", title);
    network?.state.kv.set("word_count", word_count);
    network?.state.kv.set("summary", summary);

    console.log(`Content creation completed: ${title} (${word_count} words)`);
    console.log(`Summary: ${summary}`);

    return `Content creation completed: ${title} (${word_count} words). Summary: ${summary}`;
  }
});

const contentCreationAgent = createAgent({
  name: "content-creation-agent",
  description: "An agent that manages content creation tasks.",
  system:`You are a professional content creation assistant.
 
    Your workflow:
    1. 🔍 Research the topic using your web search capabilities to gather current information
    2. 🗄️ Check existing database tables and create new ones if needed (use SQL)
    3. ✍️ Generate high-quality, engaging content based on your research
    4. 💾 Store the content and metadata in the database using SQL
    5. ✅ Call the 'done' tool when finished
    
    Recommended database schema to create:
    CREATE TABLE IF NOT EXISTS content_pieces (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    topic VARCHAR(255),
    content_type VARCHAR(100) DEFAULT 'blog_post',
    word_count INTEGER,
    keywords TEXT[],
    research_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS research_sources (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES content_pieces(id),
    source_title VARCHAR(255),
    source_summary TEXT,
    relevance_score INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW()
    );
    
    Content Creation Guidelines:
    - Write engaging, informative content
    - Include practical tips and actionable advice
    - Use proper headings and structure
    - Aim for the requested word count
    - Make content SEO-friendly with relevant keywords
    
    IMPORTANT: Always call the 'done' tool when you finish creating and storing content!`,

    model: openai({
      model: "gpt-4o-mini",
      defaultParameters: {
        max_completion_tokens: 1000    
      }
    }),
  tools: [doneTool],
  mcpServers:[
    {
        name: "neon",
        transport:{
            type:"streamable-http",
            url: neonServerUrl.toString()
        }
    }
  ]
});

const contentCreationNetwork = createNetwork({
  name: "content-creation-network",
  description: "A network for managing content creation tasks.",
  agents: [contentCreationAgent],
  router:({network})=>{
    const isCompleted = network?.state.kv.get("completed");
    const attempts = Number(network?.state.kv.get("attempts") ?? 0);

    if (isCompleted) {
      console.log("Content creation completed. No further routing needed.");
      return undefined;
    }

    if (attempts >= MAX_ROUTER_ATTEMPTS) {
      console.log(
        `Max retry attempts reached (${MAX_ROUTER_ATTEMPTS}). Stopping routing.`
      );
      return undefined;
    }

    network?.state.kv.set("attempts", attempts + 1);
    console.log(
      `Content creation not completed. Attempt ${attempts + 1}/${MAX_ROUTER_ATTEMPTS}. Routing to content-creation-agent.`
    );
    return contentCreationAgent;
  },
  defaultModel: openai({
    model: "gpt-4o-mini",
    defaultParameters: {
      max_completion_tokens: 1000    
    }
  })
}); 

const server = createServer({
  networks: [contentCreationNetwork],
});

server.listen(PORT, () => {
  console.log("🚀 Content Creation Assistant running on http://localhost:3010");
  console.log("🗄️ Connected to Neon PostgreSQL via MCP");
  console.log("");
  console.log("📋 Setup Instructions:");
  console.log(
    "1. Set GEMENI _API_KEY and SMITHERY_API_KEY in src/.env"
  );
  console.log(
    "2. Run: npx inngest-cli@latest dev -u http://localhost:3010/api/inngest"
  );
  console.log("3. Open: http://localhost:8288");
  console.log("");
  console.log("💡 Try this prompt:");
  console.log(
    "'Create a comprehensive blog post about sustainable urban gardening for beginners. Make it 1000 words with practical tips and include SEO keywords.'"
  );
  console.log("");
  console.log("🔍 What the agent will do:");
  console.log("- Research sustainable urban gardening using web search");
  console.log("- Create database tables for content storage");
  console.log("- Generate comprehensive blog post content");
  console.log("- Store content with metadata in Neon database");
  console.log("- Provide completion summary with word count");
});

