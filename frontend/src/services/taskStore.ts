import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  token: 'USDC' | 'XLM' | 'EURC';
  creator: string;
  assignee: string | null;
  status: 'Open' | 'InEscrow' | 'Assigned' | 'Completed' | 'Disputed';
  deadline: string;
  tags: string[];
  applicants: string[];
  reputationRequired: number;
  disputeReason?: string;
  completionSubmitted?: boolean;
}

export interface PaymentLog {
  id: string;
  taskId: string;
  taskTitle: string;
  amount: number;
  token: 'USDC' | 'XLM' | 'EURC';
  type: 'Funding' | 'Payout' | 'Fee';
  timestamp: string;
  txHash: string;
  sender: string;
  recipient: string;
}

export interface UserProfile {
  address: string;
  username: string;
  reputation: number;
  earnings: number;
  tasksCompleted: number;
  role: 'Creator' | 'Contributor' | 'Admin';
  hasCompletedOnboarding: boolean;
}

interface GovernanceConfig {
  initialized: boolean;
  adminAddress: string;
  platformFeeBps: number; // basis points, e.g., 250 = 2.5%
  whitelistedTokens: ('USDC' | 'XLM' | 'EURC')[];
  paused: boolean;
}

interface TaskState {
  tasks: Task[];
  currentUser: UserProfile;
  governance: GovernanceConfig;
  payments: PaymentLog[];
  initialized: boolean;

  // Actions
  initializePlatform: (
    admin: string,
    feeBps: number,
    whitelisted: ('USDC' | 'XLM' | 'EURC')[]
  ) => void;
  createTask: (
    title: string,
    description: string,
    reward: number,
    token: 'USDC' | 'XLM' | 'EURC',
    deadline: string,
    tags: string[],
    reputationRequired: number
  ) => void;
  fundTask: (taskId: string) => void;
  applyForTask: (taskId: string, applicantAddress: string) => void;
  assignTask: (taskId: string, contributorAddress: string) => void;
  submitCompletion: (taskId: string) => void;
  completeTaskAndPayout: (taskId: string) => void;
  triggerDispute: (taskId: string, reason: string) => void;
  resolveDispute: (taskId: string, resolution: 'Creator' | 'Contributor' | 'Split') => void;
  updateProfile: (
    username: string,
    address: string,
    role: 'Creator' | 'Contributor' | 'Admin'
  ) => void;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
  setPlatformFee: (feeBps: number) => void;
  togglePause: () => void;
  resetAll: () => void;
}

const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implement Stellar Soroban Smart Contract for Escrow',
    description:
      'We need a robust smart contract written in Rust for locking tokens (USDC/XLM) in escrow and releasing them upon confirmation. It should support platform fee deduction (2.5%) and optional 2-of-3 multi-sig dispute arbitration.',
    reward: 500,
    token: 'USDC',
    creator: 'G-CREATOR-LatterFix-777',
    assignee: 'G-CONTRIB-Alice-888',
    status: 'Assigned',
    deadline: '2026-08-15',
    tags: ['Rust', 'Soroban', 'Smart Contract'],
    applicants: ['G-CONTRIB-Alice-888', 'G-CONTRIB-Bob-999'],
    reputationRequired: 80,
    completionSubmitted: false,
  },
  {
    id: 'task-2',
    title: 'Design UI for Task Manager Dashboard',
    description:
      'Create a state-of-the-art Web3 dashboard UI. Needs to have support for dark mode, glassmorphic panels, visual transaction logs, and profile reputation widgets. Must look clean and futuristic.',
    reward: 1200,
    token: 'XLM',
    creator: 'G-CREATOR-LatterFix-777',
    assignee: null,
    status: 'InEscrow',
    deadline: '2026-07-30',
    tags: ['React', 'TailwindCSS', 'UI/UX'],
    applicants: ['G-CONTRIB-Alice-888'],
    reputationRequired: 50,
    completionSubmitted: false,
  },
  {
    id: 'task-3',
    title: 'Integrate Stellar Wallets Kit (Freighter, Albedo, Rovo)',
    description:
      'Implement frontend integration with `@creit.tech/stellar-wallets-kit`. Users should be able to connect their wallet, request signatures for transactions, and view their balance directly on the dashboard.',
    reward: 350,
    token: 'EURC',
    creator: 'G-CREATOR-LatterFix-777',
    assignee: null,
    status: 'Open',
    deadline: '2026-09-01',
    tags: ['Stellar SDK', 'Wallets', 'TypeScript'],
    applicants: [],
    reputationRequired: 70,
    completionSubmitted: false,
  },
  {
    id: 'task-4',
    title: 'Audit Escrow Contracts for Reentrancy Bugs',
    description:
      'Perform a comprehensive security audit of our Soroban escrow implementation. Look for integer overflow issues, authorization bypasses in `require_auth()` calls, and edge cases in path payment routines.',
    reward: 800,
    token: 'USDC',
    creator: 'G-CREATOR-Admin-111',
    assignee: 'G-CONTRIB-Bob-999',
    status: 'Completed',
    deadline: '2026-07-05',
    tags: ['Audit', 'Security', 'Rust'],
    applicants: ['G-CONTRIB-Bob-999'],
    reputationRequired: 90,
    completionSubmitted: false,
  },
];

const initialPayments: PaymentLog[] = [
  {
    id: 'tx-1',
    taskId: 'task-4',
    taskTitle: 'Audit Escrow Contracts for Reentrancy Bugs',
    amount: 800,
    token: 'USDC',
    type: 'Payout',
    timestamp: '2026-07-05 14:32:10',
    txHash: 'e6b72a8c3d9a1f4b0e5d8c7b6f2a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a21',
    sender: 'G-CONTRACT-ESCROW-000',
    recipient: 'G-CONTRIB-Bob-999',
  },
  {
    id: 'tx-2',
    taskId: 'task-4',
    taskTitle: 'Audit Escrow Contracts for Reentrancy Bugs (Platform Fee)',
    amount: 20,
    token: 'USDC',
    type: 'Fee',
    timestamp: '2026-07-05 14:32:10',
    txHash: 'e6b72a8c3d9a1f4b0e5d8c7b6f2a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a21',
    sender: 'G-CONTRACT-ESCROW-000',
    recipient: 'G-CREATOR-Admin-111',
  },
  {
    id: 'tx-3',
    taskId: 'task-2',
    taskTitle: 'Design UI for Task Manager Dashboard',
    amount: 1200,
    token: 'XLM',
    type: 'Funding',
    timestamp: '2026-07-10 09:15:42',
    txHash: 'a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7',
    sender: 'G-CREATOR-LatterFix-777',
    recipient: 'G-CONTRACT-ESCROW-000',
  },
];

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: initialTasks,
      currentUser: {
        address: 'G-CONTRIB-Alice-888',
        username: 'LatterFixer',
        reputation: 95,
        earnings: 1450,
        tasksCompleted: 4,
        role: 'Contributor',
        hasCompletedOnboarding: false,
      },
      governance: {
        initialized: true,
        adminAddress: 'G-CREATOR-Admin-111',
        platformFeeBps: 250, // 2.5%
        whitelistedTokens: ['USDC', 'XLM', 'EURC'],
        paused: false,
      },
      payments: initialPayments,
      initialized: true,

      initializePlatform: (admin, feeBps, whitelisted) => {
        set((state) => ({
          governance: {
            ...state.governance,
            initialized: true,
            adminAddress: admin,
            platformFeeBps: feeBps,
            whitelistedTokens: whitelisted,
          },
        }));
      },

      createTask: (title, description, reward, token, deadline, tags, reputationRequired) => {
        const newTask: Task = {
          id: `task-${Date.now()}`,
          title,
          description,
          reward,
          token,
          creator: get().currentUser.address,
          assignee: null,
          status: 'Open',
          deadline,
          tags,
          applicants: [],
          reputationRequired,
          completionSubmitted: false,
        };

        set((state) => ({
          tasks: [newTask, ...state.tasks],
        }));
      },

      fundTask: (taskId) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          if (task.status !== 'Open') return state;

          updatedTasks[taskIndex] = { ...task, status: 'InEscrow' };

          // Create standard transaction hash
          const mockHash = Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');

          const newPayment: PaymentLog = {
            id: `tx-${Date.now()}`,
            taskId: task.id,
            taskTitle: task.title,
            amount: task.reward,
            token: task.token,
            type: 'Funding',
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            txHash: mockHash,
            sender: state.currentUser.address,
            recipient: 'G-CONTRACT-ESCROW-000',
          };

          return {
            tasks: updatedTasks,
            payments: [newPayment, ...state.payments],
          };
        });
      },

      applyForTask: (taskId, applicantAddress) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          if (task.applicants.includes(applicantAddress)) return state;

          updatedTasks[taskIndex] = {
            ...task,
            applicants: [...task.applicants, applicantAddress],
          };

          return { tasks: updatedTasks };
        });
      },

      assignTask: (taskId, contributorAddress) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          if (task.status !== 'InEscrow') return state;

          updatedTasks[taskIndex] = {
            ...task,
            assignee: contributorAddress,
            status: 'Assigned',
          };

          return { tasks: updatedTasks };
        });
      },

      submitCompletion: (taskId) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          if (task.status !== 'Assigned') return state;

          updatedTasks[taskIndex] = {
            ...task,
            completionSubmitted: true,
          };

          return { tasks: updatedTasks };
        });
      },

      completeTaskAndPayout: (taskId) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          if (task.status !== 'Assigned') return state;

          // Calculate fees
          const feePercentage = state.governance.platformFeeBps / 10000;
          const feeAmount = parseFloat((task.reward * feePercentage).toFixed(4));
          const netPayout = parseFloat((task.reward - feeAmount).toFixed(4));

          updatedTasks[taskIndex] = {
            ...task,
            status: 'Completed',
            completionSubmitted: false,
          };

          const txHash = Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

          const payoutTx: PaymentLog = {
            id: `tx-payout-${Date.now()}`,
            taskId: task.id,
            taskTitle: task.title,
            amount: netPayout,
            token: task.token,
            type: 'Payout',
            timestamp,
            txHash,
            sender: 'G-CONTRACT-ESCROW-000',
            recipient: task.assignee || 'Unknown',
          };

          const feeTx: PaymentLog = {
            id: `tx-fee-${Date.now()}`,
            taskId: task.id,
            taskTitle: `${task.title} (Platform Fee)`,
            amount: feeAmount,
            token: task.token,
            type: 'Fee',
            timestamp,
            txHash,
            sender: 'G-CONTRACT-ESCROW-000',
            recipient: state.governance.adminAddress,
          };

          // If current user is the assignee, update their stats
          let updatedUser = state.currentUser;
          if (task.assignee === state.currentUser.address) {
            updatedUser = {
              ...state.currentUser,
              reputation: Math.min(100, state.currentUser.reputation + 2),
              earnings: state.currentUser.earnings + netPayout,
              tasksCompleted: state.currentUser.tasksCompleted + 1,
            };
          }

          return {
            tasks: updatedTasks,
            payments: [payoutTx, feeTx, ...state.payments],
            currentUser: updatedUser,
          };
        });
      },

      triggerDispute: (taskId, reason) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          updatedTasks[taskIndex] = {
            ...task,
            status: 'Disputed',
            disputeReason: reason,
          };

          return { tasks: updatedTasks };
        });
      },

      resolveDispute: (taskId, resolution) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return state;

          const updatedTasks = [...state.tasks];
          const task = updatedTasks[taskIndex];

          if (task.status !== 'Disputed') return state;

          const txHash = Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

          const newPayments: PaymentLog[] = [];
          let updatedUser = state.currentUser;

          if (resolution === 'Creator') {
            // Full refund to creator
            newPayments.push({
              id: `tx-refund-${Date.now()}`,
              taskId: task.id,
              taskTitle: `${task.title} (Refund)`,
              amount: task.reward,
              token: task.token,
              type: 'Payout',
              timestamp,
              txHash,
              sender: 'G-CONTRACT-ESCROW-000',
              recipient: task.creator,
            });
            // Reduce assignee reputation
            if (task.assignee === state.currentUser.address) {
              updatedUser = {
                ...state.currentUser,
                reputation: Math.max(0, state.currentUser.reputation - 5),
              };
            }
          } else if (resolution === 'Contributor') {
            // Full payout to contributor
            const feePercentage = state.governance.platformFeeBps / 10000;
            const feeAmount = parseFloat((task.reward * feePercentage).toFixed(4));
            const netPayout = parseFloat((task.reward - feeAmount).toFixed(4));

            newPayments.push({
              id: `tx-payout-${Date.now()}`,
              taskId: task.id,
              taskTitle: task.title,
              amount: netPayout,
              token: task.token,
              type: 'Payout',
              timestamp,
              txHash,
              sender: 'G-CONTRACT-ESCROW-000',
              recipient: task.assignee || 'Unknown',
            });

            newPayments.push({
              id: `tx-fee-${Date.now()}`,
              taskId: task.id,
              taskTitle: `${task.title} (Platform Fee)`,
              amount: feeAmount,
              token: task.token,
              type: 'Fee',
              timestamp,
              txHash,
              sender: 'G-CONTRACT-ESCROW-000',
              recipient: state.governance.adminAddress,
            });

            if (task.assignee === state.currentUser.address) {
              updatedUser = {
                ...state.currentUser,
                earnings: state.currentUser.earnings + netPayout,
                tasksCompleted: state.currentUser.tasksCompleted + 1,
              };
            }
          } else {
            // Split 50-50
            const half = parseFloat((task.reward / 2).toFixed(4));

            newPayments.push({
              id: `tx-split-creator-${Date.now()}`,
              taskId: task.id,
              taskTitle: `${task.title} (50% Refund)`,
              amount: half,
              token: task.token,
              type: 'Payout',
              timestamp,
              txHash,
              sender: 'G-CONTRACT-ESCROW-000',
              recipient: task.creator,
            });

            newPayments.push({
              id: `tx-split-contrib-${Date.now()}`,
              taskId: task.id,
              taskTitle: `${task.title} (50% Payout)`,
              amount: half,
              token: task.token,
              type: 'Payout',
              timestamp,
              txHash,
              sender: 'G-CONTRACT-ESCROW-000',
              recipient: task.assignee || 'Unknown',
            });

            if (task.assignee === state.currentUser.address) {
              updatedUser = {
                ...state.currentUser,
                earnings: state.currentUser.earnings + half,
                tasksCompleted: state.currentUser.tasksCompleted + 1,
              };
            }
          }

          updatedTasks[taskIndex] = {
            ...task,
            status: 'Completed',
            disputeReason: undefined,
          };

          return {
            tasks: updatedTasks,
            payments: [...newPayments, ...state.payments],
            currentUser: updatedUser,
          };
        });
      },

      updateProfile: (username, address, role) => {
        set((state) => ({
          currentUser: {
            ...state.currentUser,
            username,
            address,
            role,
          },
        }));
      },

      completeOnboarding: () => {
        set((state) => ({
          currentUser: {
            ...state.currentUser,
            hasCompletedOnboarding: true,
          },
        }));
      },

      restartOnboarding: () => {
        set((state) => ({
          currentUser: {
            ...state.currentUser,
            hasCompletedOnboarding: false,
          },
        }));
      },

      setPlatformFee: (feeBps) => {
        set((state) => ({
          governance: {
            ...state.governance,
            platformFeeBps: feeBps,
          },
        }));
      },

      togglePause: () => {
        set((state) => ({
          governance: {
            ...state.governance,
            paused: !state.governance.paused,
          },
        }));
      },

      resetAll: () => {
        set({
          tasks: initialTasks,
          currentUser: {
            address: 'G-CONTRIB-Alice-888',
            username: 'LatterFixer',
            reputation: 95,
            earnings: 1450,
            tasksCompleted: 4,
            role: 'Contributor',
            hasCompletedOnboarding: false,
          },
          governance: {
            initialized: true,
            adminAddress: 'G-CREATOR-Admin-111',
            platformFeeBps: 250,
            whitelistedTokens: ['USDC', 'XLM', 'EURC'],
            paused: false,
          },
          payments: initialPayments,
        });
      },
    }),
    {
      name: 'latterfix-task-manager-store',
    }
  )
);
