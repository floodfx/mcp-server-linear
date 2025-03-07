import { LinearClient, type Project, type User, type WorkflowState } from "@linear/sdk";
import { FastMCP } from "fastmcp";
import { z } from "zod";

const server = new FastMCP({
  name: "Linear MCP Server",
  version: "0.0.1"
});

const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});

server.addTool({
  name: "linear-search-issues",
  description: "Search for issues in Linear",
  parameters: z.object({
    query: z.string().describe("Search term"),
    teamId: z.string().optional().describe("Filter by team ID"),
    status: z.string().optional().describe("Filter by status name (e.g., 'In Progress', 'Done')"),
    assigneeId: z.string().optional().describe("Filter by assignee's user ID"),
    labels: z.array(z.string()).optional().describe("Filter by label names"),
    project: z.string().optional().describe("Filter by project name"),
    priority: z.number().optional().describe("Filter by priority (1=urgent, 2=high, 3=normal, 4=low)"),
    estimate: z.number().optional().describe("Filter by estimate points"),
    includeArchived: z.boolean().optional().describe("Include archived issues in results (default: false)"),
    limit: z.number().optional().describe("Max results to return (default: 10)").default(10),
  }),
  execute: async (args) => {
    try {
      const filter: any = {};

      if (args.query) {
        filter.or = [
          { title: { contains: args.query } },
          { description: { contains: args.query } }
        ];
      }

      if (args.teamId) {
        filter.team = { id: { eq: args.teamId } };
      }

      if (args.status) {
        filter.state = { name: { eq: args.status } };
      }

      if (args.assigneeId) {
        filter.assignee = { id: { eq: args.assigneeId } };
      }

      if (args.labels && args.labels.length > 0) {
        filter.labels = {
          some: {
            name: { in: args.labels }
          }
        };
      }

      if (args.project) {
        filter.project = { name: { eq: args.project } };
      }

      if (args.priority) {
        filter.priority = { eq: args.priority };
      }

      if (args.estimate) {
        filter.estimate = { eq: args.estimate };
      }

      // search for issues
      const res = await linear.searchIssues(args.query, {
        filter: filter,
        first: args.limit,
        includeArchived: args.includeArchived || false,
      });
      // map the issues to the expected format
      const issues = await Promise.all(res.nodes.map(async(node) => {
        let status: WorkflowState | null = null;
        if(node.state) {;
          status = (await node.state);
        }
        let assignee: User | null = null;
        if(node.assignee) {
          assignee = (await node.assignee);
        }
        let project: Project | null = null;
        if(node.project) {
          project = (await node.project);
        }
        return {
          id: node.id,
          identifier: node.identifier,
          title: node.title,
          description: node.description,
          priority: node.priority,
          estimate: node.estimate,
          status,
          assignee,
          project,
          url: node.url
        }
      }));

      return {content: issues.map((issue) => ({type: "text", text: JSON.stringify(issue)}))};
    } catch (error) {
      return {content: [{type: "text", text: `Error: ${error}`}]};
    }
  }
});


server.start({
  transportType: "stdio",
});
