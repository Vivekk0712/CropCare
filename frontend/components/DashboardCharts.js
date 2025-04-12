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
    
    // Professional color palette
    const colorPalette = [
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 205, 86, 0.8)',
      'rgba(201, 203, 207, 0.8)',
      'rgba(94, 215, 172, 0.8)',
      'rgba(138, 121, 235, 0.8)',
      'rgba(235, 178, 121, 0.8)'
    ];
    
    // Lighter versions for hover states
    const hoverColorPalette = colorPalette.map(color => 
      color.replace('0.8', '1')
    );
    
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
        type: 'doughnut', // Changed from pie to doughnut for more modern look
        data: {
          labels: diseaseLabels,
          datasets: [{
            data: diseaseCounts,
            backgroundColor: colorPalette.slice(0, diseaseLabels.length),
            hoverBackgroundColor: hoverColorPalette.slice(0, diseaseLabels.length),
            borderWidth: 1,
            borderColor: 'white'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            title: {
              display: true,
              text: 'Disease Distribution',
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: {
                top: 10,
                bottom: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 12,
              titleFont: {
                size: 14
              },
              bodyFont: {
                size: 13
              },
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          },
          cutout: '60%',
          animation: {
            animateScale: true,
            animateRotate: true
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
            backgroundColor: colorPalette.slice(0, diseaseLabels.length),
            hoverBackgroundColor: hoverColorPalette.slice(0, diseaseLabels.length),
            borderWidth: 1,
            borderColor: 'white',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              },
              ticks: {
                callback: function(value) {
                  return value + '%';
                }
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Average Confidence by Disease',
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: {
                top: 10,
                bottom: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 12,
              callbacks: {
                label: function(context) {
                  return `Confidence: ${context.raw}%`;
                }
              }
            },
            legend: {
              display: false
            }
          },
          animation: {
            duration: 1500,
            easing: 'easeOutQuart'
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
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(75, 192, 192, 1)',
            pointBorderColor: 'white',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'white',
            pointHoverBorderColor: 'rgba(75, 192, 192, 1)',
            pointHoverBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
                stepSize: 1
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Prediction Activity Over Time',
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: {
                top: 10,
                bottom: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 12,
              intersect: false,
              mode: 'index'
            },
            legend: {
              labels: {
                usePointStyle: true,
                pointStyle: 'circle'
              }
            }
          },
          animation: {
            duration: 2000,
            easing: 'easeOutQuart'
          },
          elements: {
            line: {
              borderWidth: 3
            }
          }
        }
      });
    }
  };

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <div className="chart-container">
          <canvas ref={pieChartRef}></canvas>
        </div>
      </div>
      
      <div className="chart-card">
        <div className="chart-container">
          <canvas ref={barChartRef}></canvas>
        </div>
      </div>
      
      <div className="chart-card full-width">
        <div className="chart-container">
          <canvas ref={lineChartRef}></canvas>
        </div>
      </div>

      <style jsx>{`
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
          gap: 25px;
          margin-bottom: 30px;
        }
        
        .chart-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          height: 380px;
          transition: all 0.3s ease;
        }
        
        .chart-card:hover {
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.12);
          transform: translateY(-5px);
        }
        
        .chart-container {
          position: relative;
          height: 100%;
          width: 100%;
        }
        
        .full-width {
          grid-column: 1 / -1;
        }

        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
          
          .chart-card {
            height: 320px;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardCharts; 