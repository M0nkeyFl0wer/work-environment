/**
 * GitHub Integration Module
 * Handles all GitHub operations including issues, PRs, webhooks, and repository management
 */

const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const EventEmitter = require('events');

class GitHubIntegration extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            owner: config.owner || process.env.GITHUB_OWNER,
            repo: config.repo || process.env.GITHUB_REPO,
            token: config.token || process.env.GITHUB_TOKEN,
            autoCreateIssues: config.autoCreateIssues !== false,
            autoAssign: config.autoAssign !== false,
            labels: config.labels || ['ueos-generated'],
            webhookSecret: config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET,
            ...config
        };

        this.octokit = null;
        this.webhooks = new Map();
        this.issueTemplates = new Map();

        this.initialize();
    }

    async initialize() {
        // Initialize Octokit client
        if (this.config.token) {
            this.octokit = new Octokit({
                auth: this.config.token,
                userAgent: 'UEOS/1.0.0',
                timeZone: 'America/New_York',
                baseUrl: 'https://api.github.com'
            });
        } else if (this.config.appId && this.config.privateKey) {
            // GitHub App authentication
            this.octokit = new Octokit({
                authStrategy: createAppAuth,
                auth: {
                    appId: this.config.appId,
                    privateKey: this.config.privateKey,
                    installationId: this.config.installationId
                }
            });
        } else {
            throw new Error('GitHub authentication not configured');
        }

        // Verify authentication
        await this.verifyAuthentication();

        // Load issue templates
        await this.loadIssueTemplates();

        this.emit('initialized');
    }

    async verifyAuthentication() {
        try {
            const { data } = await this.octokit.users.getAuthenticated();
            this.emit('authenticated', { user: data.login });
            return true;
        } catch (error) {
            this.emit('authentication:failed', error);
            throw new Error(`GitHub authentication failed: ${error.message}`);
        }
    }

    async createIssue(options) {
        const issueData = {
            owner: options.owner || this.config.owner,
            repo: options.repo || this.config.repo,
            title: options.title,
            body: this.formatIssueBody(options),
            labels: [...this.config.labels, ...(options.labels || [])],
            assignees: this.determineAssignees(options),
            milestone: options.milestone
        };

        try {
            const { data } = await this.octokit.issues.create(issueData);

            this.emit('issue:created', {
                number: data.number,
                url: data.html_url,
                title: data.title
            });

            // Add to project board if configured
            if (this.config.projectId) {
                await this.addToProject(data.id, this.config.projectId);
            }

            // Set up auto-response if needed
            if (options.autoRespond) {
                await this.setupAutoResponse(data.number, options.autoRespond);
            }

            return data;

        } catch (error) {
            this.emit('issue:failed', error);
            throw error;
        }
    }

    formatIssueBody(options) {
        if (options.template && this.issueTemplates.has(options.template)) {
            return this.renderTemplate(options.template, options);
        }

        const sections = [];

        // Header
        if (options.summary) {
            sections.push(`## Summary\n${options.summary}`);
        }

        // Context
        if (options.context) {
            sections.push(`## Context\n\`\`\`json\n${JSON.stringify(options.context, null, 2)}\n\`\`\``);
        }

        // Error Details
        if (options.error) {
            sections.push(`## Error Details\n\`\`\`\n${options.error.stack || options.error.message}\n\`\`\``);
        }

        // Workflow Information
        if (options.workflow) {
            sections.push(`## Workflow Information
- **Task:** ${options.workflow.task}
- **Phase:** ${options.workflow.phase}
- **Execution ID:** ${options.workflow.executionId}
- **Timestamp:** ${new Date().toISOString()}`);
        }

        // Reproduction Steps
        if (options.steps) {
            sections.push(`## Steps to Reproduce\n${options.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
        }

        // Expected vs Actual
        if (options.expected && options.actual) {
            sections.push(`## Expected Behavior\n${options.expected}\n\n## Actual Behavior\n${options.actual}`);
        }

        // Action Items
        if (options.actionItems) {
            sections.push(`## Action Required\n${options.actionItems.map(item => `- [ ] ${item}`).join('\n')}`);
        }

        // Footer
        sections.push(`\n---\n*This issue was automatically generated by UEOS v${this.config.version || '1.0.0'}*`);

        return sections.join('\n\n');
    }

    determineAssignees(options) {
        const assignees = [];

        if (options.assignees) {
            assignees.push(...options.assignees);
        }

        if (this.config.autoAssign && this.config.defaultAssignee) {
            assignees.push(this.config.defaultAssignee);
        }

        return [...new Set(assignees)]; // Remove duplicates
    }

    async createPullRequest(options) {
        try {
            // Create branch if needed
            if (options.createBranch) {
                await this.createBranch(options.branch, options.baseBranch || 'main');
            }

            // Create PR
            const { data } = await this.octokit.pulls.create({
                owner: options.owner || this.config.owner,
                repo: options.repo || this.config.repo,
                title: options.title,
                body: this.formatPRBody(options),
                head: options.branch,
                base: options.baseBranch || 'main',
                draft: options.draft || false,
                maintainer_can_modify: true
            });

            this.emit('pr:created', {
                number: data.number,
                url: data.html_url,
                title: data.title
            });

            // Add reviewers if specified
            if (options.reviewers) {
                await this.addReviewers(data.number, options.reviewers);
            }

            // Enable auto-merge if configured
            if (options.autoMerge) {
                await this.enableAutoMerge(data.number, options.autoMerge);
            }

            return data;

        } catch (error) {
            this.emit('pr:failed', error);
            throw error;
        }
    }

    formatPRBody(options) {
        const sections = [];

        // Summary
        sections.push(`## Summary\n${options.summary || 'Automated changes by UEOS'}`);

        // Changes
        if (options.changes) {
            sections.push(`## Changes\n${options.changes.map(c => `- ${c}`).join('\n')}`);
        }

        // Testing
        sections.push(`## Testing\n${options.testing || '- [ ] Tests pass\n- [ ] Manual testing completed'}`);

        // Checklist
        if (options.checklist) {
            sections.push(`## Checklist\n${options.checklist.map(item => `- [ ] ${item}`).join('\n')}`);
        }

        // Related Issues
        if (options.issues) {
            sections.push(`## Related Issues\n${options.issues.map(i => `- Closes #${i}`).join('\n')}`);
        }

        // Footer
        sections.push(`\n---\n*PR generated by UEOS*`);

        return sections.join('\n\n');
    }

    async setupWebhook(options) {
        try {
            const { data } = await this.octokit.repos.createWebhook({
                owner: options.owner || this.config.owner,
                repo: options.repo || this.config.repo,
                name: 'web',
                active: true,
                events: options.events || ['issues', 'pull_request', 'push'],
                config: {
                    url: options.url,
                    content_type: 'json',
                    secret: options.secret || this.config.webhookSecret,
                    insecure_ssl: '0'
                }
            });

            this.webhooks.set(data.id, data);
            this.emit('webhook:created', { id: data.id, url: options.url });

            return data;

        } catch (error) {
            this.emit('webhook:failed', error);
            throw error;
        }
    }

    async addToProject(issueId, projectId) {
        try {
            await this.octokit.projects.createCard({
                column_id: projectId,
                content_id: issueId,
                content_type: 'Issue'
            });

            this.emit('project:added', { issueId, projectId });
        } catch (error) {
            this.emit('project:failed', error);
        }
    }

    async addReviewers(prNumber, reviewers) {
        try {
            await this.octokit.pulls.requestReviewers({
                owner: this.config.owner,
                repo: this.config.repo,
                pull_number: prNumber,
                reviewers: Array.isArray(reviewers) ? reviewers : [reviewers]
            });

            this.emit('reviewers:added', { prNumber, reviewers });
        } catch (error) {
            this.emit('reviewers:failed', error);
        }
    }

    async enableAutoMerge(prNumber, options = {}) {
        try {
            await this.octokit.graphql(`
                mutation($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
                    enablePullRequestAutoMerge(input: {
                        pullRequestId: $pullRequestId,
                        mergeMethod: $mergeMethod
                    }) {
                        pullRequest {
                            autoMergeRequest {
                                enabledAt
                            }
                        }
                    }
                }
            `, {
                pullRequestId: prNumber,
                mergeMethod: options.method || 'SQUASH'
            });

            this.emit('automerge:enabled', { prNumber });
        } catch (error) {
            this.emit('automerge:failed', error);
        }
    }

    async createBranch(branchName, baseBranch = 'main') {
        try {
            // Get base branch SHA
            const { data: baseRef } = await this.octokit.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${baseBranch}`
            });

            // Create new branch
            const { data } = await this.octokit.git.createRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `refs/heads/${branchName}`,
                sha: baseRef.object.sha
            });

            this.emit('branch:created', { branch: branchName });
            return data;

        } catch (error) {
            if (error.status === 422) {
                // Branch already exists
                this.emit('branch:exists', { branch: branchName });
                return null;
            }
            throw error;
        }
    }

    async createRelease(options) {
        try {
            const { data } = await this.octokit.repos.createRelease({
                owner: options.owner || this.config.owner,
                repo: options.repo || this.config.repo,
                tag_name: options.tag,
                target_commitish: options.target || 'main',
                name: options.name || options.tag,
                body: options.body || '',
                draft: options.draft || false,
                prerelease: options.prerelease || false,
                generate_release_notes: options.generateNotes !== false
            });

            this.emit('release:created', {
                id: data.id,
                url: data.html_url,
                tag: data.tag_name
            });

            return data;

        } catch (error) {
            this.emit('release:failed', error);
            throw error;
        }
    }

    async getWorkflowRuns(workflowId) {
        try {
            const { data } = await this.octokit.actions.listWorkflowRuns({
                owner: this.config.owner,
                repo: this.config.repo,
                workflow_id: workflowId,
                per_page: 10
            });

            return data.workflow_runs;

        } catch (error) {
            this.emit('workflow:failed', error);
            throw error;
        }
    }

    async triggerWorkflow(workflowId, options = {}) {
        try {
            await this.octokit.actions.createWorkflowDispatch({
                owner: this.config.owner,
                repo: this.config.repo,
                workflow_id: workflowId,
                ref: options.ref || 'main',
                inputs: options.inputs || {}
            });

            this.emit('workflow:triggered', { workflowId });

        } catch (error) {
            this.emit('workflow:failed', error);
            throw error;
        }
    }

    async setupAutoResponse(issueNumber, responseConfig) {
        // Set up automated responses to issue comments
        const webhook = await this.setupWebhook({
            url: responseConfig.url,
            events: ['issue_comment'],
            secret: responseConfig.secret
        });

        this.emit('autoresponse:setup', { issueNumber, webhookId: webhook.id });
    }

    async loadIssueTemplates() {
        const templates = {
            bug: {
                title: '🐛 Bug Report: {title}',
                labels: ['bug', 'needs-triage'],
                body: `## Bug Description\n{description}\n\n## Environment\n{environment}\n\n## Steps to Reproduce\n{steps}`
            },
            feature: {
                title: '✨ Feature Request: {title}',
                labels: ['enhancement', 'needs-review'],
                body: `## Feature Description\n{description}\n\n## Use Case\n{useCase}\n\n## Proposed Solution\n{solution}`
            },
            blocked: {
                title: '🚧 Workflow Blocked: {title}',
                labels: ['blocked', 'urgent'],
                body: `## Blockage Description\n{description}\n\n## Impact\n{impact}\n\n## Required Action\n{action}`
            }
        };

        templates.forEach((template, name) => {
            this.issueTemplates.set(name, template);
        });
    }

    renderTemplate(templateName, data) {
        const template = this.issueTemplates.get(templateName);
        if (!template) return '';

        let body = template.body;
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            body = body.replace(regex, data[key] || '');
        });

        return body;
    }

    async searchIssues(query, options = {}) {
        try {
            const searchQuery = `repo:${this.config.owner}/${this.config.repo} ${query}`;

            const { data } = await this.octokit.search.issuesAndPullRequests({
                q: searchQuery,
                sort: options.sort || 'created',
                order: options.order || 'desc',
                per_page: options.limit || 30
            });

            return data.items;

        } catch (error) {
            this.emit('search:failed', error);
            throw error;
        }
    }

    async updateIssue(issueNumber, updates) {
        try {
            const { data } = await this.octokit.issues.update({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                ...updates
            });

            this.emit('issue:updated', { number: issueNumber });
            return data;

        } catch (error) {
            this.emit('issue:update:failed', error);
            throw error;
        }
    }

    async addComment(issueNumber, comment) {
        try {
            const { data } = await this.octokit.issues.createComment({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                body: comment
            });

            this.emit('comment:added', { issueNumber, commentId: data.id });
            return data;

        } catch (error) {
            this.emit('comment:failed', error);
            throw error;
        }
    }

    async closeIssue(issueNumber, comment) {
        try {
            if (comment) {
                await this.addComment(issueNumber, comment);
            }

            await this.updateIssue(issueNumber, { state: 'closed' });
            this.emit('issue:closed', { number: issueNumber });

        } catch (error) {
            this.emit('issue:close:failed', error);
            throw error;
        }
    }

    getMetrics() {
        return {
            webhooks: this.webhooks.size,
            templates: this.issueTemplates.size,
            authenticated: !!this.octokit
        };
    }
}

module.exports = { GitHubIntegration };