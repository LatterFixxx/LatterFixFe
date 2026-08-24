import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Coins,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  User,
  ShieldCheck,
  Plus,
  Loader2,
  Activity,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTaskStore } from '../services/taskStore';
import { useWallet } from '../hooks/useWallet';
import { useHorizonAccount } from '../hooks/useHorizonAccount';
import {
  queryGetStatistics,
  queryGetEscrowStats,
  type SorobanContractStatistics,
  type SorobanEscrowStats,
} from '../services/sorobanTaskContract';
import { fetchNetworkFeeStats, type NetworkFeeStats } from '../services/transactionHistory';
import { getExplorerUrl } from '../services/stellar';

export default function Home() {
  const navigate = useNavigate();
  const { tasks, currentUser, payments } = useTaskStore();
  const { address, connect } = useWallet();
  const { balances, isLoading: balancesLoading } = useHorizonAccount(address);

  const [contractStats, setContractStats] = useState<SorobanContractStatistics | null>(null);
  const [escrowStats, setEscrowStats] = useState<SorobanEscrowStats | null>(null);
  const [feeStats, setFeeStats] = useState<NetworkFeeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      queryGetStatistics().catch(() => null),
      queryGetEscrowStats().catch(() => null),
      fetchNetworkFeeStats().catch(() => null),
    ]).then(([stats, escrow, fees]) => {
      setContractStats(stats);
      setEscrowStats(escrow);
      setFeeStats(fees);
      setStatsLoading(false);
    });
  }, []);

  // Filter tasks based on status
  const openTasks = tasks.filter((t) => t.status === 'Open');
  const escrowTasks = tasks.filter((t) => t.status === 'InEscrow');
  const assignedTasks = tasks.filter((t) => t.status === 'Assigned');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');
  const disputedTasks = tasks.filter((t) => t.status === 'Disputed');

  // Compute metrics
  const totalTasks = tasks.length;
  const tvl = tasks
    .filter((t) => ['InEscrow', 'Assigned', 'Disputed'].includes(t.status))
    .reduce((sum, t) => sum + t.reward, 0);

  // Admin stats
  const totalPlatformFees = payments
    .filter((p) => p.type === 'Fee')
    .reduce((sum, p) => sum + p.amount, 0);

  // User-specific tasks
  const userTasks = tasks.filter((t) => {
    if (currentUser.role === 'Creator') {
      return t.creator === currentUser.address;
    } else if (currentUser.role === 'Contributor') {
      return t.assignee === currentUser.address || t.applicants.includes(currentUser.address);
    }
    return true; // Admin sees all
  });

  // Chart data 1: Payments volume over time (mocked from payment history)
  const chartData = [
    { name: 'May', Volume: 200, TVL: 500 },
    { name: 'Jun', Volume: 800, TVL: 1200 },
    { name: 'Jul', Volume: tvl + 500, TVL: tvl },
  ];

  // Chart data 2: Task distribution
  const taskDistribution = [
    { name: 'Open', value: openTasks.length, color: '#6c5ce7' },
    { name: 'In Escrow', value: escrowTasks.length, color: '#f1c40f' },
    { name: 'Assigned', value: assignedTasks.length, color: '#3498db' },
    { name: 'Completed', value: completedTasks.length, color: '#2ecc71' },
    { name: 'Disputed', value: disputedTasks.length, color: '#e74c3c' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8 page-fade">
      {/* Welcome Banner */}
      <div
        id="tour-welcome"
        className="relative overflow-hidden rounded-3xl bg-linear-to-r from-slate-900 via-purple-950 to-slate-900 border border-white/5 p-8 sm:p-10 shadow-2xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(124,111,247,0.15),transparent_45%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent mb-4 border border-accent/20">
              <TrendingUp className="w-3.5 h-3.5" /> Stellar Soroban Ecosystem
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-3">
              Task Manager <span className="text-accent">Pro</span>
            </h1>
            <p className="text-muted text-base sm:text-lg leading-relaxed">
              Decentralized, escrow-powered project agreements. Ensure payment security, instant
              settlements, and verify developer reputation on the Stellar ledger.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            {currentUser.role === 'Creator' && (
              <button
                onClick={() => navigate('/create-task')}
                className="flex items-center gap-2 px-6 py-3.5 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 transition-transform shadow-lg shadow-accent/20"
              >
                <Plus className="w-4 h-4" /> Create Task
              </button>
            )}
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-2 px-6 py-3.5 glass border-hi text-white font-extrabold rounded-2xl hover:bg-white/5 transition-all"
            >
              Explore Tasks <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Live On-chain Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'On-chain Tasks Created',
            value: contractStats ? String(contractStats.totalTasksCreated) : '—',
            sub: 'Soroban contract',
            icon: <Activity className="w-4 h-4 text-accent" />,
          },
          {
            label: 'Total Value Settled',
            value: contractStats
              ? `${(Number(contractStats.totalValuePaid) / 1e7).toFixed(2)}`
              : '—',
            sub: 'Tokens (7 decimals)',
            icon: <Coins className="w-4 h-4 text-green-400" />,
          },
          {
            label: 'Active On-chain Escrows',
            value: escrowStats ? String(escrowStats.activeEscrows) : '—',
            sub: 'Locked in contract',
            icon: <ShieldCheck className="w-4 h-4 text-yellow-400" />,
          },
          {
            label: 'Network Congestion',
            value: feeStats ? feeStats.congestion.toUpperCase() : '—',
            sub: `Base: ${feeStats ? feeStats.baseFee : '?'} stroops`,
            icon: <Zap className="w-4 h-4 text-purple-400" />,
          },
        ].map((stat) => (
          <div key={stat.label} className="card glass noise p-4 space-y-2">
            <div className="flex items-center justify-between">
              {stat.icon}
              {statsLoading && stat.value === '—' ? (
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              ) : null}
            </div>
            <p className="text-xl font-black text-white">{stat.value}</p>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-[9px] text-white/30">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet Balance Panel */}
      {address && (
        <div className="card glass noise p-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <User className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-mono">
                {address.slice(0, 8)}...{address.slice(-6)}
              </p>
              <p className="text-[10px] text-muted">Connected Wallet</p>
            </div>
          </div>
          {[
            { token: 'XLM', balance: balances.XLM },
            { token: 'USDC', balance: balances.USDC },
            { token: 'EURC', balance: balances.EURC },
          ].map(({ token, balance }) => (
            <div key={token} className="text-center">
              <p className="text-lg font-black text-white">
                {balancesLoading ? '...' : parseFloat(balance).toFixed(4)}
              </p>
              <p className="text-[10px] text-muted">{token}</p>
            </div>
          ))}
          <a
            href={getExplorerUrl('account', address)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] text-accent hover:underline flex items-center gap-1"
          >
            Stellar Expert ↗
          </a>
        </div>
      )}

      {!address && (
        <div className="card glass noise p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white">Connect Wallet to See Live Balances</p>
            <p className="text-xs text-muted mt-0.5">Supports Freighter, xBull, and Lobstr.</p>
          </div>
          <button
            onClick={connect}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-bg font-extrabold rounded-xl hover:scale-105 transition-transform text-xs shrink-0"
          >
            <Zap className="w-3.5 h-3.5" /> Connect Wallet
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card glass noise flex items-center justify-between p-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
              Total Tasks
            </p>
            <h3 className="text-3xl font-black text-white">{totalTasks}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="card glass noise flex items-center justify-between p-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
              Total Value Locked
            </p>
            <h3 className="text-3xl font-black text-accent flex items-baseline gap-1">
              {tvl.toLocaleString()}{' '}
              <span className="text-xs font-normal text-muted">USDC/XLM</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 text-accent">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        <div className="card glass noise flex items-center justify-between p-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
              Completed Agreements
            </p>
            <h3 className="text-3xl font-black text-white">{completedTasks.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="card glass noise flex items-center justify-between p-6">
          {currentUser.role === 'Admin' ? (
            <>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
                  Fees Collected (2.5%)
                </p>
                <h3 className="text-3xl font-black text-purple-400">
                  {totalPlatformFees.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-muted">USDC</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
                  My Reputation Score
                </p>
                <h3 className="text-3xl font-black text-white">
                  {currentUser.reputation}{' '}
                  <span className="text-xs font-normal text-muted">/ 100</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                <User className="w-6 h-6" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Charts & Feed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Middle Column - Chart */}
        <div className="lg:col-span-2 card glass noise p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Stellar Activity & TVL Volume</h3>
              <p className="text-xs text-muted">
                Monthly escrow growth and transaction settlement volume
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent">
                <span className="w-2.5 h-2.5 rounded-full bg-accent" /> TVL
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-purple-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Settled
              </span>
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTVL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4af0b8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4af0b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c6ff7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7c6ff7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#8b949e" fontSize={11} tickLine={false} />
                <YAxis stroke="#8b949e" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(13, 17, 23, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="TVL"
                  stroke="#4af0b8"
                  fillOpacity={1}
                  fill="url(#colorTVL)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Volume"
                  stroke="#7c6ff7"
                  fillOpacity={1}
                  fill="url(#colorVol)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column - Status breakdown */}
        <div className="card glass noise p-6 flex flex-col justify-between">
          <div className="border-b border-white/5 pb-4 mb-4">
            <h3 className="text-lg font-bold text-white">Task Status Breakdown</h3>
            <p className="text-xs text-muted">Distribution of smart contract agreements</p>
          </div>
          {taskDistribution.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {taskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full text-xs">
                {taskDistribution.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5 font-medium text-white/80">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate">
                      {entry.name}: {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm py-10">
              No task data recorded.
            </div>
          )}
        </div>
      </div>

      {/* User-specific Active Tasks & Network Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Active Tasks */}
        <div className="lg:col-span-2 card glass noise p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-lg font-bold text-white">My Platform Tasks</h3>
            <span className="text-xs font-mono bg-white/5 px-2.5 py-1 rounded-md text-muted">
              {currentUser.role} View
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {userTasks.length > 0 ? (
              userTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          task.status === 'Completed'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : task.status === 'Disputed'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : task.status === 'Assigned'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : task.status === 'InEscrow'
                                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {task.status}
                      </span>
                      <span className="text-xs font-mono text-muted">#{task.id}</span>
                    </div>
                    <h4
                      className="text-sm font-bold text-white hover:text-accent cursor-pointer truncate"
                      onClick={() => navigate('/tasks')}
                    >
                      {task.title}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-white">
                      {task.reward} {task.token}
                    </p>
                    <p className="text-[11px] text-muted">Due {task.deadline}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted text-sm">
                No active tasks found for your current profile.
              </div>
            )}
          </div>
        </div>

        {/* Recent Platform/Network Activity */}
        <div className="card glass noise p-6 space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-lg font-bold text-white">Live Escrow Log</h3>
          </div>
          <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
            {payments.slice(0, 5).map((pay) => (
              <div key={pay.id} className="flex gap-3 text-xs leading-normal">
                <div className="shrink-0 mt-0.5">
                  {pay.type === 'Payout' && (
                    <span className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                  {pay.type === 'Funding' && (
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px] font-bold">
                      $
                    </span>
                  )}
                  {pay.type === 'Fee' && (
                    <span className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 text-[10px] font-bold">
                      %
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white/90 font-medium">
                    {pay.type === 'Funding'
                      ? 'Task funded'
                      : pay.type === 'Payout'
                        ? 'Payment released'
                        : 'Platform fee collected'}
                  </p>
                  <p className="text-[10px] text-muted truncate">{pay.taskTitle}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="font-bold text-white/70">
                      {pay.type === 'Fee' ? '+' : ''}
                      {pay.amount} {pay.token}
                    </span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${pay.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-mono text-accent hover:underline"
                    >
                      {pay.txHash.slice(0, 6)}...{pay.txHash.slice(-4)}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
