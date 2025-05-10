import { Component } from '@angular/core';

@Component({
  selector: 'app-catalogo-marca',
  imports: [],
  templateUrl: './catalogo-marca.component.html',
  styleUrl: './catalogo-marca.component.scss'
})
export class CatalogoMarcaComponent {

  limpiarFiltros(): void {
    const checkboxes = document.querySelectorAll('.filters-sidebar input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
  }
}
