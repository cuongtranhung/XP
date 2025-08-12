/**
 * Lazy-loaded Chart Components
 * Splits Chart.js into a separate bundle for better performance
 */

import React, { lazy, Suspense } from 'react';


// Create a loading component for charts
const ChartLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
      <p className="mt-2 text-sm text-gray-600">Loading chart...</p>
    </div>
  </div>
);

// Lazy load chart components
const LazyLineChart = lazy(() => 
  import('react-chartjs-2').then(module => ({
    default: module.Line
  }))
);

const LazyBarChart = lazy(() => 
  import('react-chartjs-2').then(module => ({
    default: module.Bar
  }))
);

const LazyDoughnutChart = lazy(() => 
  import('react-chartjs-2').then(module => ({
    default: module.Doughnut
  }))
);

// Also lazy load Chart.js registration
export const registerChartJS = () => {
  return import('chart.js').then((chartModule) => {
    const {
      Chart: ChartJS,
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      BarElement,
      ArcElement,
      Title,
      Tooltip,
      Legend,
      Filler
    } = chartModule;
    
    ChartJS.register(
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      BarElement,
      ArcElement,
      Title,
      Tooltip,
      Legend,
      Filler
    );
  });
};

// Export wrapped components with any props type for now
export const LineChart: React.FC<any> = (props) => (
  <Suspense fallback={<ChartLoader />}>
    <LazyLineChart {...props} />
  </Suspense>
);

export const BarChart: React.FC<any> = (props) => (
  <Suspense fallback={<ChartLoader />}>
    <LazyBarChart {...props} />
  </Suspense>
);

export const DoughnutChart: React.FC<any> = (props) => (
  <Suspense fallback={<ChartLoader />}>
    <LazyDoughnutChart {...props} />
  </Suspense>
);