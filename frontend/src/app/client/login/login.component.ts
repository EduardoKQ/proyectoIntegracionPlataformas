import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    ReactiveFormsModule,CommonModule
  ],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup | undefined;
  rememberMe: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  onSubmit(): void {
    if (this.loginForm && this.loginForm.valid) {
      this.router.navigate(['/product']);
    } else if (this.loginForm) {
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm!.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  forgotPassword(): void {
  }
}
