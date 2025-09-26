/**
 * Swarm Orchestrator - Advanced Multi-Agent Coordination System
 * Manages distributed AI agents for spec-driven development
 */

const EventEmitter = require('events');
const { ResearchAgent } = require('./agents/research-agent');
const { SpecAgent } = require('./agents/spec-agent');
const { DevAgent } = require('./agents/dev-agent');
const { QAAgent } = require('./agents/qa-agent');
const { IntegrationAgent } = require('./agents/integration-agent');
const { MessageQueue } = require('./message-queue');
const { TaskDecomposer } = require('./task-decomposer');

class SwarmOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            maxAgents: config.maxAgents || 7,
            topology: config.topology || 'adaptive',
            performanceMode: config.performanceMode || false,
            parallelExecution: config.parallelExecution !== false,
            autoRetry: config.autoRetry !== false,
            maxRetries: config.maxRetries || 3,
            ...config
        };

        this.agents = {};
        this.messageQueue = new MessageQueue();
        this.taskDecomposer = new TaskDecomposer();
        this.executionState = new Map();
        this.metrics = {
            tasksCompleted: 0,
            tasksFailed: 0,
            totalExecutionTime: 0,
            agentUtilization: {}
        };

        this.initialize();
    }

    async initialize() {
        // Initialize agents based on topology
        const topology = this.determineTopology();

        this.agents = {
            research: new ResearchAgent({
                ...this.config,
                maxConcurrent: Math.floor(this.config.maxAgents * 0.3)
            }),
            spec: new SpecAgent({
                ...this.config,
                templates: await this.loadSpecTemplates()
            }),
            dev: new DevAgent({
                ...this.config,
                maxConcurrent: Math.floor(this.config.maxAgents * 0.3)
            }),
            qa: new QAAgent({
                ...this.config,
                strategies: ['unit', 'integration', 'e2e']
            }),
            integration: new IntegrationAgent({
                ...this.config,
                services: ['github', 'webhooks']
            })
        };

        // Setup inter-agent communication
        this.setupCommunication();

        // Initialize performance monitoring
        if (this.config.performanceMode) {
            this.initializePerformanceMode();
        }

        this.emit('initialized', { agents: Object.keys(this.agents) });
    }

    determineTopology() {
        switch (this.config.topology) {
            case 'linear':
                return this.createLinearTopology();
            case 'parallel':
                return this.createParallelTopology();
            case 'adaptive':
                return this.createAdaptiveTopology();
            default:
                return this.createAdaptiveTopology();
        }
    }

    createAdaptiveTopology() {
        // Adaptive topology adjusts based on task complexity
        return {
            structure: 'adaptive',
            flows: [
                { from: 'orchestrator', to: 'research', condition: 'always' },
                { from: 'research', to: 'spec', condition: 'data_gathered' },
                { from: 'spec', to: ['dev', 'qa'], condition: 'spec_complete' },
                { from: 'dev', to: 'qa', condition: 'code_complete' },
                { from: 'qa', to: 'integration', condition: 'tests_pass' },
                { from: '*', to: 'orchestrator', condition: 'blocked' }
            ]
        };
    }

    setupCommunication() {
        // Setup message passing between agents
        Object.entries(this.agents).forEach(([name, agent]) => {
            agent.on('message', (message) => {
                this.handleAgentMessage(name, message);
            });

            agent.on('error', (error) => {
                this.handleAgentError(name, error);
            });

            agent.on('complete', (result) => {
                this.handleAgentComplete(name, result);
            });
        });
    }

    async executeTask(task, options = {}) {
        const startTime = Date.now();
        const executionId = this.generateExecutionId();

        this.emit('execution:start', { executionId, task });

        try {
            // Decompose task into subtasks
            const decomposition = await this.taskDecomposer.decompose(task);

            this.executionState.set(executionId, {
                task,
                decomposition,
                status: 'in_progress',
                startTime,
                results: {}
            });

            // Execute research phase
            const research = await this.executeResearchPhase(decomposition.research);

            // Generate specifications
            const spec = await this.executeSpecPhase(research, decomposition.requirements);

            // Parallel execution of development and initial QA
            const [development, qaPrep] = await Promise.all([
                this.executeDevelopmentPhase(spec),
                this.prepareQAPhase(spec)
            ]);

            // Execute QA phase
            const qa = await this.executeQAPhase(development, qaPrep);

            // Integration phase
            const integration = await this.executeIntegrationPhase({
                spec,
                development,
                qa
            });

            // Compile final result
            const result = {
                executionId,
                task,
                spec,
                code: development.code,
                tests: qa.tests,
                documentation: integration.documentation,
                deployment: integration.deployment,
                metrics: {
                    executionTime: Date.now() - startTime,
                    agentMetrics: this.collectAgentMetrics()
                }
            };

            this.executionState.get(executionId).status = 'completed';
            this.executionState.get(executionId).results = result;

            this.emit('execution:complete', result);
            this.metrics.tasksCompleted++;

            return result;

        } catch (error) {
            this.executionState.get(executionId).status = 'failed';
            this.executionState.get(executionId).error = error;

            this.emit('execution:failed', { executionId, error });
            this.metrics.tasksFailed++;

            // Attempt recovery or escalation
            if (this.config.autoRetry && this.shouldRetry(executionId)) {
                return await this.retryExecution(executionId, task, options);
            }

            throw error;
        } finally {
            this.metrics.totalExecutionTime += Date.now() - startTime;
        }
    }

    async executeResearchPhase(researchTasks) {
        this.emit('phase:start', { phase: 'research' });

        const results = await Promise.all(
            researchTasks.map(task =>
                this.agents.research.execute(task)
            )
        );

        const consolidated = this.agents.research.consolidate(results);

        this.emit('phase:complete', { phase: 'research', results: consolidated });
        return consolidated;
    }

    async executeSpecPhase(research, requirements) {
        this.emit('phase:start', { phase: 'specification' });

        const spec = await this.agents.spec.generate({
            research,
            requirements,
            compliance: this.config.compliance || [],
            domain: this.config.domain
        });

        // Validate specification
        const validation = await this.agents.spec.validate(spec);
        if (!validation.valid) {
            throw new Error(`Specification validation failed: ${validation.errors.join(', ')}`);
        }

        this.emit('phase:complete', { phase: 'specification', spec });
        return spec;
    }

    async executeDevelopmentPhase(spec) {
        this.emit('phase:start', { phase: 'development' });

        // Break down development into parallel tasks
        const devTasks = this.agents.dev.planImplementation(spec);

        const implementations = await this.executeParallelTasks(
            devTasks,
            this.agents.dev,
            this.config.maxAgents * 0.4
        );

        // Integrate all implementations
        const integrated = await this.agents.dev.integrate(implementations);

        this.emit('phase:complete', { phase: 'development', code: integrated });
        return integrated;
    }

    async prepareQAPhase(spec) {
        // Prepare test cases while development is in progress
        return await this.agents.qa.prepareTestSuite(spec);
    }

    async executeQAPhase(development, testSuite) {
        this.emit('phase:start', { phase: 'quality_assurance' });

        const testResults = await this.agents.qa.execute({
            code: development.code,
            testSuite,
            coverage: this.config.coverageTarget || 80
        });

        if (testResults.failed > 0) {
            // Attempt to fix failing tests
            const fixes = await this.agents.dev.fixFailingTests(testResults);

            if (fixes.success) {
                // Re-run tests
                const retestResults = await this.agents.qa.execute({
                    code: fixes.code,
                    testSuite,
                    coverage: this.config.coverageTarget || 80
                });

                if (retestResults.failed === 0) {
                    this.emit('phase:complete', { phase: 'quality_assurance', tests: retestResults });
                    return retestResults;
                }
            }

            // Escalate if tests still failing
            await this.escalateToHuman('QA Failed', testResults);
        }

        this.emit('phase:complete', { phase: 'quality_assurance', tests: testResults });
        return testResults;
    }

    async executeIntegrationPhase(artifacts) {
        this.emit('phase:start', { phase: 'integration' });

        const integration = await this.agents.integration.process(artifacts);

        // Create GitHub artifacts
        if (this.config.github?.enabled) {
            await this.agents.integration.createGitHubArtifacts({
                ...integration,
                repository: this.config.github.repository,
                branch: this.config.github.branch || 'main'
            });
        }

        // Send notifications
        if (this.config.notifications?.enabled) {
            await this.agents.integration.sendNotifications({
                type: 'completion',
                artifacts: integration,
                channels: this.config.notifications.channels
            });
        }

        this.emit('phase:complete', { phase: 'integration', results: integration });
        return integration;
    }

    async executeParallelTasks(tasks, agent, maxConcurrent) {
        const results = [];
        const executing = [];

        for (const task of tasks) {
            const promise = agent.execute(task).then(result => {
                executing.splice(executing.indexOf(promise), 1);
                return result;
            });

            executing.push(promise);

            if (executing.length >= maxConcurrent) {
                const result = await Promise.race(executing);
                results.push(result);
            }
        }

        // Wait for remaining tasks
        const remaining = await Promise.all(executing);
        results.push(...remaining);

        return results;
    }

    async escalateToHuman(reason, details) {
        this.emit('escalation', { reason, details });

        if (this.config.github?.autoCreateIssues) {
            const issue = await this.agents.integration.createGitHubIssue({
                title: `UEOS Workflow Blocked: ${reason}`,
                body: this.formatIssueBody(reason, details),
                assignees: this.config.github.assignees || [],
                labels: ['ueos-blocked', 'needs-human-intervention']
            });

            this.emit('issue:created', issue);
        }

        if (this.config.notifications?.webhooks) {
            await this.agents.integration.sendWebhook({
                url: this.config.notifications.webhooks.blocked,
                payload: { reason, details, timestamp: new Date().toISOString() }
            });
        }
    }

    formatIssueBody(reason, details) {
        return `## Workflow Blocked

**Reason:** ${reason}

**Details:**
\`\`\`json
${JSON.stringify(details, null, 2)}
\`\`\`

**Execution Context:**
- Time: ${new Date().toISOString()}
- Swarm Config: ${this.config.topology}
- Agents: ${this.config.maxAgents}

**Actions Required:**
Please review the details and provide guidance or manual intervention as needed.

---
*This issue was automatically generated by UEOS*`;
    }

    handleAgentMessage(agentName, message) {
        this.emit('agent:message', { agent: agentName, message });

        // Route message to appropriate handler
        if (message.type === 'broadcast') {
            this.broadcastToAgents(message, agentName);
        } else if (message.target) {
            this.routeToAgent(message.target, message);
        }
    }

    handleAgentError(agentName, error) {
        this.emit('agent:error', { agent: agentName, error });

        // Log error for debugging
        console.error(`Agent ${agentName} error:`, error);

        // Attempt recovery
        if (this.config.autoRetry) {
            this.recoverAgent(agentName);
        }
    }

    handleAgentComplete(agentName, result) {
        this.emit('agent:complete', { agent: agentName, result });

        // Update metrics
        if (!this.metrics.agentUtilization[agentName]) {
            this.metrics.agentUtilization[agentName] = {
                tasksCompleted: 0,
                totalTime: 0
            };
        }

        this.metrics.agentUtilization[agentName].tasksCompleted++;
        this.metrics.agentUtilization[agentName].totalTime += result.executionTime || 0;
    }

    async recoverAgent(agentName) {
        try {
            // Restart agent
            await this.agents[agentName].restart();
            this.emit('agent:recovered', { agent: agentName });
        } catch (error) {
            this.emit('agent:recovery:failed', { agent: agentName, error });
        }
    }

    broadcastToAgents(message, excludeAgent) {
        Object.entries(this.agents).forEach(([name, agent]) => {
            if (name !== excludeAgent) {
                agent.receiveMessage(message);
            }
        });
    }

    routeToAgent(targetAgent, message) {
        if (this.agents[targetAgent]) {
            this.agents[targetAgent].receiveMessage(message);
        }
    }

    shouldRetry(executionId) {
        const execution = this.executionState.get(executionId);
        return (execution.retries || 0) < this.config.maxRetries;
    }

    async retryExecution(executionId, task, options) {
        const execution = this.executionState.get(executionId);
        execution.retries = (execution.retries || 0) + 1;

        this.emit('execution:retry', {
            executionId,
            attempt: execution.retries
        });

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, execution.retries), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));

        return await this.executeTask(task, options);
    }

    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    collectAgentMetrics() {
        const metrics = {};

        Object.entries(this.agents).forEach(([name, agent]) => {
            metrics[name] = agent.getMetrics();
        });

        return metrics;
    }

    async loadSpecTemplates() {
        // Load domain-specific specification templates
        const templates = {
            medical: require('../templates/spec-kits/medical'),
            financial: require('../templates/spec-kits/financial'),
            web: require('../templates/spec-kits/web'),
            api: require('../templates/spec-kits/api')
        };

        return templates;
    }

    initializePerformanceMode() {
        // Setup performance optimizations
        this.config.caching = true;
        this.config.compression = true;
        this.config.batchRequests = true;

        // Adjust agent configurations for performance
        Object.values(this.agents).forEach(agent => {
            agent.enablePerformanceMode();
        });
    }

    async shutdown() {
        this.emit('shutdown:start');

        // Gracefully shutdown all agents
        await Promise.all(
            Object.values(this.agents).map(agent => agent.shutdown())
        );

        // Close message queue
        await this.messageQueue.close();

        // Save metrics
        await this.saveMetrics();

        this.emit('shutdown:complete');
    }

    async saveMetrics() {
        const fs = require('fs').promises;
        const path = require('path');

        const metricsPath = path.join(
            process.env.UEOS_HOME || `${process.env.HOME}/.ueos`,
            'runtime/metrics',
            `metrics_${Date.now()}.json`
        );

        await fs.writeFile(
            metricsPath,
            JSON.stringify(this.metrics, null, 2)
        );
    }

    getStatus() {
        return {
            agents: Object.entries(this.agents).reduce((acc, [name, agent]) => {
                acc[name] = agent.getStatus();
                return acc;
            }, {}),
            executions: Array.from(this.executionState.entries()).map(([id, state]) => ({
                id,
                status: state.status,
                task: state.task,
                startTime: state.startTime
            })),
            metrics: this.metrics
        };
    }
}

module.exports = { SwarmOrchestrator };