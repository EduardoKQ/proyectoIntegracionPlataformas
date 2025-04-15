import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'frontend';
  backendStatus = "loading...";
  databaseStatus = "loading...";

  // ngOnInit is called after Angular initializes the component
  async ngOnInit() {
    try {
      const healthData = await backendHealthCheck();
      // Update properties once data is fetched
      this.backendStatus = healthData['backend-status'];
      this.databaseStatus = healthData['database-status'];
      console.log('Health Check Data:', healthData); // For testing
    } catch (error) {
      console.error('Error fetching health check:', error);
      this.backendStatus = 'error';
      this.databaseStatus = 'error';
    }
  }

}

async function backendHealthCheck(): Promise<any> {
  // Use the correct health check endpoint URL if needed (e.g., /api/health/)
  const response = await fetch('http://localhost:8100/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // Throw an error with more context if possible
    const errorText = await response.text();
    throw new Error(`Network response was not ok (${response.status}): ${errorText}`);
  }
  return response.json(); // Parse the JSON response
}
