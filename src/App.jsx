import { useProposalAgent } from './useProposalAgent.js';
import RedesignView from './views/RedesignView.jsx';
import './styles/redesign.css';

function App() {
  const agent = useProposalAgent();
  return <RedesignView agent={agent} />;
}

export default App;
