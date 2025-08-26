<?php

namespace App\Entity;

use App\Repository\UserRepository;
use DateTimeInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')]
#[ORM\UniqueConstraint(name: 'UNIQ_IDENTIFIER_EMAIL', fields: ['email'])]
#[UniqueEntity(fields: ['email'], message: 'There is already an account with this email')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private ?string $email = null;

    /**
     * @var list<string> The user roles
     */
    #[ORM\Column]
    private array $roles = [];

    /**
     * @var string The hashed password
     */
    #[ORM\Column]
    private ?string $password = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    private ?DateTimeInterface $LastLogin = null;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $deltas = null;

    /**
     * @var Collection<int, Repertoire>
     */
    #[ORM\OneToMany(targetEntity: Repertoire::class, mappedBy: 'User', orphanRemoval: true)]
    private Collection $repertoires;

    #[ORM\OneToOne(mappedBy: 'User', cascade: ['persist', 'remove'])]
    private ?Settings $settings = null;

    public function __construct()
    {
        $this->repertoires = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function getLastLogin(): ?\DateTimeInterface
    {
        return $this->LastLogin;
    }

    public function setLastLogin(\DateTimeInterface $LastLogin): static
    {
        $this->LastLogin = $LastLogin;

        return $this;
    }

    public function getDeltas(): ?array
    {
        return $this->deltas;
    }

    public function setDeltas(?array $deltas): self
    {
        $this->deltas = $deltas;
        return $this;
    }

    // --- New helper to add a delta ---
    public function addDelta(int $delta, int $max = 10): self
    {
        $current = $this->deltas ?? [];
        $current[] = $delta;

        // Keep only the last $max deltas
        if (count($current) > $max) {
            $current = array_slice($current, -$max);
        }

        $this->deltas = $current;
        return $this;
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    /**
     * @see UserInterface
     *
     * @return list<string>
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    /**
     * @param list<string> $roles
     */
    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    /**
     * @see PasswordAuthenticatedUserInterface
     */
    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    /**
     * @see UserInterface
     */
    public function eraseCredentials(): void
    {
        // If you store any temporary, sensitive data on the user, clear it here
        // $this->plainPassword = null;
    }

    /**
     * @return Collection<int, Repertoire>
     */
    public function getRepertoires(): Collection
    {
        return $this->repertoires;
    }

    public function addRepertoire(Repertoire $repertoire): static
    {
        if (!$this->repertoires->contains($repertoire)) {
            $this->repertoires->add($repertoire);
            $repertoire->setUser($this);
        }

        return $this;
    }

    public function removeRepertoire(Repertoire $repertoire): static
    {
        if ($this->repertoires->removeElement($repertoire)) {
            // set the owning side to null (unless already changed)
            if ($repertoire->getUser() === $this) {
                $repertoire->setUser(null);
            }
        }

        return $this;
    }

    public function getSettings(): ?Settings
    {
        return $this->settings;
    }

    public function setSettings(Settings $settings): static
    {
        // set the owning side of the relation if necessary
        if ($settings->getUser() !== $this) {
            $settings->setUser($this);
        }

        $this->settings = $settings;

        return $this;
    }
}
