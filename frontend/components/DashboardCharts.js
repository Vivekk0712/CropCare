import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

const DashboardCharts = ({ predictions, stats }) => {
  // Chart refs
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const pieChartInstance = useRef(null);
  const barChartInstance = useRef(null);
  const lineChartInstance = useRef(null);

  useEffect(() => {
    if (predictions.length > 0) {
      createCharts();
    }

    // Clean up charts when component unmounts
    return () => {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }
    };
  }, [predictions, stats]);

  const createCharts = () => {
    const diseaseLabels = Object.keys(stats.diseaseCounts);
    const diseaseCounts = Object.values(stats.diseaseCounts);
    
    // Prepare data for confidence by disease chart
    const diseaseConfidences = {};
    const diseaseConfidenceCounts = {};
    
    predictions.forEach(prediction => {
      const disease = prediction.prediction;
      diseaseConfidences[disease] = (diseaseConfidences[disease] || 0) + prediction.confidence;
      diseaseConfidenceCounts[disease] = (diseaseConfidenceCounts[disease] || 0) + 1;
    });
    
    const avgConfidences = diseaseLabels.map(disease => 
      (diseaseConfidences[disease] / diseaseConfidenceCounts[disease]).toFixed(2)
    );
    
    // Prepare data for time series chart
    const timeData = {};
    const sortedPredictions = [...predictions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    sortedPredictions.forEach(prediction => {
      const date = new Date(prediction.created_at).toLocaleDateString();
      timeData[date] = (timeData[date] || 0) + 1;
    });
    
    const timeLabels = Object.keys(timeData);
    const timeCounts = Object.values(timeData);
    
    // Create or update pie chart
    if (pieChartRef.current) {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
      
      pieChartInstance.current = new Chart(pieChartRef.current, {
        type: 'pie',
        data: {
          labels: diseaseLabels,
          datasets: [{
            data: diseaseCounts,
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
              '#FF9F40', '#8AC249', '#EA5545', '#87BC45', '#D85040'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Disease Distribution'
            }
          }
        }
      });
    }
    
    // Create or update bar chart
    if (barChartRef.current) {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      
      barChartInstance.current = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: diseaseLabels,
          datasets: [{
            label: 'Average Confidence (%)',
            data: avgConfidences,
            backgroundColor: '#36A2EB'
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Average Confidence by Disease'
            }
          }
        }
      });
    }
    
    // Create or update line chart
    if (lineChartRef.current) {
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }
      
      lineChartInstance.current = new Chart(lineChartRef.current, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [{
            label: 'Number of Predictions',
            data: timeCounts,
            borderColor: '#4BC0C0',
            tension: 0.1,
            fill: false
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Prediction Activity Over Time'
            }
          }
        }
      });
    }
  };

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <canvas ref={pieChartRef}></canvas>
      </div>
      
      <div className="chart-card">
        <canvas ref={barChartRef}></canvas>
      </div>
      
      <div className="chart-card full-width">
        <canvas ref={lineChartRef}></canvas>
      </div>

      <style jsx>{`
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .chart-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          height: 350px;
        }
        
        .full-width {
          grid-column: 1 / -1;
        }

        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
          
          .chart-card {
            height: 300px;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardCharts; 