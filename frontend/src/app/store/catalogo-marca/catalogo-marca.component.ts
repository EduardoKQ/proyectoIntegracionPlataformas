import { Component } from '@angular/core';

@Component({
  selector: 'app-catalogo-marca',
  imports: [],
  templateUrl: './catalogo-marca.component.html',
  styleUrl: './catalogo-marca.component.scss'
})
export class CatalogoMarcaComponent {

  limpiarFiltros(): void {
    // Cast the entire NodeList to a more specific type
    const checkboxes = document.querySelectorAll('.filters-sidebar input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    
    // Now TypeScript knows these are HTMLInputElements
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    
    // Aquí podrías también resetear cualquier variable en el componente
    // que esté siguiendo el estado de los filtros, o emitir eventos, etc.
  }
}
