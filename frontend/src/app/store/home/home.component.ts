import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  stories = [
    {
      id: 1,
      backgroundImage: 'assets/images/histo1.png',
      badgeImage: 'assets/images/histoP.png',
      title: 'Ofertas Especiales',
      hoverText: 'Ver Promociones'
    },
    {
      id: 2,
      backgroundImage: 'assets/images/histo2.png',
      badgeImage: 'assets/images/histoM.png',
      title: 'Nuestras Marcas',
      hoverText: 'Ver Marcas'
    }
  ];


  constructor(
    private router: Router,
    private authService: AuthService
  ) {}
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  openStory(storyId: number) {
    this.router.navigate(['/story', storyId]);
  }
}
