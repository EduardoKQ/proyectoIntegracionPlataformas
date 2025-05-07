import { Component } from '@angular/core';

@Component({
  selector: 'app-catalogo',
  imports: [],
  templateUrl: './catalogo.component.html',
  styleUrl: './catalogo.component.scss'
})

export class CatalogoComponent {

  limpiarFiltros(): void {
    const checkboxes = document.querySelectorAll('.filters-sidebar input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
  }
}